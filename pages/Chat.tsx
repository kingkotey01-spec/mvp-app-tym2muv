import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getChats, fetchMessages, sendMessage, createChat, getUserProfile, mapMessage } from '../services/supabaseService';
import { Chat as ChatType, User, ChatMessage } from '../types';
import { supabase } from '../supabaseClient';
import Icon from '../components/Icon';
import { sanitizeString } from '../services/security';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ErrorBanner from '../components/ErrorBanner';
import SkeletonCard from '../components/SkeletonCard';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

interface ResponseTemplate {
  id: string;
  title: string;
  content: string;
}

const DEFAULT_TEMPLATES: ResponseTemplate[] = [
  { id: '1', title: 'Available for viewing', content: 'Hello! Yes, the property is available for viewing. When would you be free to schedule a walkthrough?' },
  { id: '2', title: 'Property details sent', content: 'Great! I have sent over the comprehensive property details, brochure, and pricing outline. Let me know if you have any questions!' },
  { id: '3', title: 'Follow-up inquiry', content: 'Hi there! Just following up on your inquiry about this property. Are you still interested or looking for something else?' },
  { id: '4', title: 'Offer received', content: 'Thank you for reaching out. An offer has already been drafted for this unit, but I can keep you updated if there are any changes.' }
];

const Chat: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { toast, confirm } = useToast();
  const [chats, setChats] = useState<ChatType[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<ChatType | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Response Templates States
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [templates, setTemplates] = useState<ResponseTemplate[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`chat_response_templates_${currentUser?.id || 'guest'}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (_) {
          return DEFAULT_TEMPLATES;
        }
      }
    }
    return DEFAULT_TEMPLATES;
  });

  const handleAddTemplate = (title: string, content: string) => {
    const newTpl = {
      id: 'tpl_' + Date.now(),
      title,
      content
    };
    const updated = [...templates, newTpl];
    setTemplates(updated);
    localStorage.setItem(`chat_response_templates_${currentUser?.id || 'guest'}`, JSON.stringify(updated));
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem(`chat_response_templates_${currentUser?.id || 'guest'}`, JSON.stringify(updated));
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`chat_response_templates_${currentUser?.id || 'guest'}`);
      if (saved) {
        try {
          setTemplates(JSON.parse(saved));
        } catch (_) {
          setTemplates(DEFAULT_TEMPLATES);
        }
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
    }
  }, [currentUser]);
  
  // Resolve other participant details
  const [participants, setParticipants] = useState<Record<string, User>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;

    // Initialize Chats with real-time listener
    const unsubscribe = getChats(currentUser.id, (updatedChats) => {
      setChats(updatedChats);
      setIsLoadingChats(false);
      
      // Resolve Users for new participants
      const userIds = new Set<string>();
      updatedChats.forEach(c => c.participants.forEach(p => {
        if (p !== currentUser.id) userIds.add(p);
      }));

      userIds.forEach(async (uid) => {
        if (!participants[uid]) {
          const u = await getUserProfile(uid);
          if (u) setParticipants(prev => ({ ...prev, [uid]: u }));
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const urlChatId = searchParams.get('chatId');
    const sourceParam = searchParams.get('source');
    if (urlChatId) {
      if (sourceParam) {
        localStorage.setItem(`chat_lead_source_${urlChatId}`, sourceParam);
      }
      setActiveChatId(urlChatId);
      return;
    }

    // Handle URL params for starting a new chat
    const startWithUserId = searchParams.get('to');
    const listingId = searchParams.get('listingId') || undefined;

    if (startWithUserId && startWithUserId !== currentUser.id) {
      const startNewChat = async () => {
        try {
          const chatId = await createChat(currentUser.id, startWithUserId, listingId);
          if (sourceParam) {
            localStorage.setItem(`chat_lead_source_${chatId}`, sourceParam);
          }
          setActiveChatId(chatId);
        } catch (error) {
          console.error("Error creating chat:", error);
          setError('Failed to start chat. Please try again.');
        }
      };
      startNewChat();
    }
  }, [searchParams, currentUser, retryKey]);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setActiveChat(undefined);
      return;
    }

    const chat = chats.find(c => c.id === activeChatId);
    setActiveChat(chat);
    
    const loadMessages = async () => {
      const msgs = await fetchMessages(activeChatId);
      setMessages(msgs);
    };
    loadMessages();
  }, [activeChatId, chats]);

  // Handle new incoming messages via realtime subscription
  useRealtimeSubscription(
    {
      table: 'messages',
      event: 'INSERT',
      filter: `chat_id=eq.${activeChatId}`,
    },
    (payload) => {
      const newMsg = mapMessage(payload.new);
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    },
    !!activeChatId // Only enabled when an active chat is selected
  );

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeChatId || !currentUser) return;

    const sanitizedMessage = sanitizeString(messageInput);
    const text = messageInput;
    setMessageInput('');

    try {
      const newMsg = await sendMessage(activeChatId, currentUser.id, sanitizedMessage);
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageInput(text); // Restore input on error
    }
  };

  const handleDeleteConversation = async (chatId: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation and all its messages? This action is permanent.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true
    });
    if (!isConfirmed) return;

    try {
      // Delete messages first to resolve foreign key constraints
      await supabase.from('messages').delete().eq('chat_id', chatId);
      // Delete chat
      const { error } = await supabase.from('chats').delete().eq('id', chatId);
      if (error) throw error;

      setChats(prev => prev.filter(c => c.id !== chatId));
      setActiveChatId(null);
      setMessages([]);
      toast('Conversation deleted successfully.', 'success');
    } catch (err: any) {
      console.error("Error deleting conversation:", err);
      toast("Failed to delete conversation. Please try again.", 'error');
    }
  };

  const handleClearAllConversations = async () => {
    if (!currentUser || chats.length === 0) return;
    const isConfirmed = await confirm({
      title: 'Clear All',
      message: 'Are you sure you want to clear and delete ALL conversations from your inbox? This cannot be undone.',
      confirmLabel: 'Clear All',
      cancelLabel: 'Cancel',
      danger: true
    });
    if (!isConfirmed) return;

    try {
      const chatIds = chats.map(c => c.id);
      
      if (chatIds.length > 0) {
        // Delete messages
        await supabase.from('messages').delete().in('chat_id', chatIds);
        // Delete chats
        const { error } = await supabase.from('chats').delete().in('id', chatIds);
        if (error) throw error;
      }

      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      toast('Inbox cleared successfully.', 'success');
    } catch (err: any) {
      console.error("Error clearing inbox:", err);
      toast("Failed to clear inbox. Please try again.", 'error');
    }
  };

  const getOtherParticipant = (chat: ChatType) => {
    const otherId = chat.participants.find(p => p !== currentUser?.id);
    return otherId ? participants[otherId] : undefined;
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 pt-6 pb-4 h-[calc(100vh-5rem)] flex items-center justify-center">
        <ErrorBanner message={error} onRetry={() => setRetryKey(k => k + 1)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-6 pb-4 h-[calc(100vh-5rem)]"> {/* Standardized padding with gap */}
        <div className="glass-card rounded-3xl shadow-lg border border-slate-200 h-full overflow-hidden flex">
          
          {isLoadingChats ? (
              <div className="w-full md:w-72 lg:w-80 flex flex-col border-r border-slate-200 bg-white/50 h-full">
                 <div className="p-3 border-b border-slate-100">
                    <h2 className="text-sm font-extrabold text-slate-800">Messages</h2>
                 </div>
                 <div className="p-4 space-y-4">
                     <SkeletonCard />
                     <SkeletonCard />
                 </div>
              </div>
          ) : chats.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center h-full py-20 text-center px-4 bg-white">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4 shadow-3xs">
                      <Icon name="messageCircle" size={28} className="text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-2">No conversations yet</h3>
                  <p className="text-slate-500 text-sm mb-6 max-w-xs leading-relaxed">
                      Browse premium properties and tap "Contact Agent" to start a fast conversation.
                  </p>
                  <Link to="/search" className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-brand-700 shadow-lg shadow-brand-500/20 transform hover:-translate-y-0.5 transition-all">
                      Browse Properties
                  </Link>
              </div>
          ) : (
              <>
                {/* Sidebar / Inbox List */}
                <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-72 lg:w-80 flex-col border-r border-slate-200 bg-white/50`}>
                   <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="text-sm font-extrabold text-slate-800">Messages</h2>
                      {chats.length > 0 && (
                        <button 
                          onClick={handleClearAllConversations}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50/55 hover:bg-red-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1 border border-red-100"
                          title="Clear entire messages inbox"
                        >
                          <Icon name="trash" size={11} /> Clear All
                        </button>
                      )}
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar">
                         {chats.map(chat => {
                             const otherUser = getOtherParticipant(chat);
                             const isUnread = chat.unreadCount > 0 && chat.lastSenderId !== currentUser?.id;
                             return (
                                 <div 
                                     key={chat.id}
                                     onClick={() => setActiveChatId(chat.id)}
                                     className={`p-3 border-b border-slate-55 cursor-pointer hover:bg-slate-50 transition-colors ${activeChatId === chat.id ? 'bg-brand-50/50 border-l-4 border-l-brand-500' : 'border-l-4 border-l-transparent'}`}
                                 >
                                     <div className="flex gap-2.5">
                                         <img 
                                           src={otherUser?.avatar || 'https://via.placeholder.com/50'} 
                                           alt={otherUser?.name} 
                                           referrerPolicy="no-referrer"
                                           className="w-10 h-10 rounded-full object-cover bg-slate-200"
                                         />
                                         <div className="flex-1 min-w-0">
                                             <div className="flex justify-between items-baseline mb-0.5">
                                                 <h3 className="font-bold text-xs text-slate-900 truncate">{otherUser?.name || 'User'}</h3>
                                                 <span className="text-[10px] text-slate-400">{chat.lastMessageTime}</span>
                                             </div>
                                             <div className="flex items-center justify-between gap-1 mt-0.5">
                                                 <p className={`text-xs truncate flex-1 ${isUnread ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                                     {chat.lastMessage || 'No messages yet.'}
                                                 </p>
                                                 {chat.leadSource && (
                                                     <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-sm border shrink-0 ${
                                                         chat.leadSource === 'Search' 
                                                             ? 'bg-blue-50 text-blue-600 border-blue-200/60' 
                                                             : chat.leadSource === 'Profile Page' 
                                                             ? 'bg-purple-50 text-purple-600 border-purple-200/60' 
                                                             : 'bg-indigo-50 text-indigo-600 border-indigo-200/60'
                                                     }`} title={`Source: ${chat.leadSource}`}>
                                                         {chat.leadSource}
                                                     </span>
                                                 )}
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             );
                         })}
                   </div>
                </div>

                {/* Chat Window */}
                <div className={`${!activeChatId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-slate-50/30`}>
                    {activeChatId ? (
                        <>
                          {/* Header */}
                          <div className="p-3 bg-white/60 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between shadow-sm">
                              <div className="flex items-center gap-3">
                                  <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                                      <Icon name="chevronRight" size={20} className="rotate-180" />
                                  </button>
                                  {(() => {
                                      const otherUser = activeChat && getOtherParticipant(activeChat);
                                      return otherUser ? (
                                          <div className="flex items-center gap-3">
                                              <div className="relative">
                                                  <img src={otherUser.avatar} alt={otherUser.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover" />
                                                  {otherUser.verified && (
                                                      <div className="absolute -bottom-1 -right-1 bg-brand-500 text-white p-0.5 rounded-full border border-white">
                                                          <Icon name="check" size={8} />
                                                      </div>
                                                  )}
                                              </div>
                                              <div>
                                                  <h3 className="font-bold text-slate-900">{otherUser.name}</h3>
                                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                      {activeChat?.listingId && (
                                                          <span className="text-[10px] text-brand-600 flex items-center gap-1 font-bold">
                                                              <Icon name="home" size={10} /> Property Inquiry
                                                          </span>
                                                      )}
                                                      {activeChat?.leadSource && (
                                                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-sm border shrink-0 ${
                                                              activeChat.leadSource === 'Search' 
                                                                  ? 'bg-blue-50 text-blue-600 border-blue-200/60' 
                                                                  : activeChat.leadSource === 'Profile Page' 
                                                                  ? 'bg-purple-50 text-purple-600 border-purple-200/60' 
                                                                  : 'bg-indigo-50 text-indigo-600 border-indigo-200/60'
                                                          }`} title={`Source: ${activeChat.leadSource}`}>
                                                              Source: {activeChat.leadSource}
                                                          </span>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                      ) : null;
                                  })()}
                              </div>
                              {activeChatId && (
                                <button
                                  onClick={() => handleDeleteConversation(activeChatId)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                  title="Delete this conversation"
                                >
                                  <Icon name="trash" size={20} />
                                </button>
                              )}
                          </div>

                          {/* Messages Area */}
                          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                              {messages.map((msg) => {
                                  const isMe = msg.senderId === currentUser?.id;
                                  return (
                                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                          <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl ${
                                              isMe 
                                              ? 'bg-brand-600 text-white rounded-tr-sm' 
                                              : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-sm'
                                          }`}>
                                              <p className="text-xs md:text-sm leading-normal">{msg.text}</p>
                                              <p className={`text-[10px] mt-0.5 text-right ${isMe ? 'text-brand-200' : 'text-slate-400'}`}>{msg.timestamp}</p>
                                          </div>
                                      </div>
                                  );
                              })}
                              <div ref={messagesEndRef} />
                          </div>

                          {/* Input Area */}
                          <div className="p-2.5 bg-white/60 backdrop-blur-sm border-t border-slate-200">
                              {showTemplates && (
                                  <div className="mb-2 p-3 bg-slate-50 border border-slate-100 rounded-xl animate-fade-in space-y-3 shadow-xs">
                                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                                              <Icon name="fileText" size={12} className="text-brand-600" />
                                              <span>Response Templates</span>
                                          </span>
                                          <button 
                                              type="button" 
                                              onClick={() => setShowCustomForm(!showCustomForm)}
                                              className="text-[10px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
                                          >
                                              <Icon name="plus" size={10} /> {showCustomForm ? 'View Templates' : 'Add Custom'}
                                          </button>
                                      </div>

                                      {showCustomForm ? (
                                          <div className="space-y-2 bg-white p-2.5 rounded-lg border border-slate-100">
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                  <input 
                                                      type="text" 
                                                      placeholder="Template Title (e.g., Available viewing)" 
                                                      value={newTemplateTitle} 
                                                      onChange={(e) => setNewTemplateTitle(e.target.value)}
                                                      className="col-span-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                                  />
                                                  <input 
                                                      type="text" 
                                                      placeholder="Response Text content..." 
                                                      value={newTemplateContent} 
                                                      onChange={(e) => setNewTemplateContent(e.target.value)}
                                                      className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                                  />
                                              </div>
                                              <div className="flex justify-end gap-2 text-xs pt-1">
                                                  <button 
                                                      type="button" 
                                                      onClick={() => {
                                                          setShowCustomForm(false);
                                                          setNewTemplateTitle('');
                                                          setNewTemplateContent('');
                                                      }}
                                                      className="px-2.5 py-1 text-slate-500 hover:text-slate-800 font-semibold"
                                                  >
                                                      Cancel
                                                  </button>
                                                  <button 
                                                      type="button" 
                                                      onClick={() => {
                                                          if (!newTemplateTitle.trim() || !newTemplateContent.trim()) return;
                                                          handleAddTemplate(newTemplateTitle, newTemplateContent);
                                                          setNewTemplateTitle('');
                                                          setNewTemplateContent('');
                                                          setShowCustomForm(false);
                                                          toast('Response Template saved!', 'success');
                                                      }}
                                                      disabled={!newTemplateTitle.trim() || !newTemplateContent.trim()}
                                                      className="px-3 py-1 bg-brand-600 text-white rounded-lg font-bold disabled:opacity-50"
                                                  >
                                                      Save Template
                                                  </button>
                                              </div>
                                          </div>
                                      ) : (
                                          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                              {templates.map((tpl) => (
                                                  <div 
                                                      key={tpl.id}
                                                      className="group flex items-center bg-white border border-slate-200 rounded-lg pl-2.5 pr-1 py-1 hover:border-brand-300 transition-all text-[11px] font-semibold text-slate-700 shadow-3xs gap-1.5"
                                                  >
                                                      <button
                                                          type="button"
                                                          onClick={() => {
                                                              setMessageInput(tpl.content);
                                                              setShowTemplates(false);
                                                          }}
                                                          className="hover:text-brand-600 text-left cursor-pointer"
                                                          title={`Use template: "${tpl.content}"`}
                                                      >
                                                          {tpl.title}
                                                      </button>
                                                      
                                                      {/* Deletion of custom templates */}
                                                      {tpl.id.startsWith('tpl_') && (
                                                          <button
                                                              type="button"
                                                              onClick={() => handleDeleteTemplate(tpl.id)}
                                                              className="p-0.5 text-slate-330 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                              title="Delete custom template"
                                                          >
                                                              <Icon name="x" size={10} />
                                                          </button>
                                                      )}
                                                  </div>
                                              ))}
                                              {templates.length === 0 && (
                                                  <span className="text-[10px] italic text-slate-400">No response templates. Click 'Add Custom' to create one!</span>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              )}

                              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                  <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-full transition-colors">
                                      <Icon name="plus" size={18} />
                                  </button>
                                  <button 
                                      type="button" 
                                      onClick={() => setShowTemplates(!showTemplates)}
                                      className={`p-1.5 rounded-full transition-colors relative ${showTemplates ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-brand-600 hover:bg-slate-100'}`}
                                      title="Response Templates"
                                  >
                                      <Icon name="fileText" size={18} />
                                      {templates.length > 0 && (
                                          <span className="absolute -top-1 -right-1 bg-brand-500 text-white font-extrabold text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">
                                              {templates.length}
                                          </span>
                                      )}
                                  </button>
                                  <input 
                                      type="text" 
                                      value={messageInput}
                                      onChange={(e) => setMessageInput(e.target.value)}
                                      placeholder="Type a message..." 
                                      className="flex-1 bg-slate-100 border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                                  />
                                  <button 
                                      type="submit" 
                                      disabled={!messageInput.trim()}
                                      className="p-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-500/20"
                                  >
                                      <Icon name="send" size={16} />
                                  </button>
                              </form>
                          </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Icon name="messageCircle" size={48} className="text-slate-300" />
                            </div>
                            <p className="text-lg">Select a conversation to start chatting</p>
                        </div>
                    )}
                </div>
              </>
          )}
        </div>
    </div>
  );
};

export default Chat;