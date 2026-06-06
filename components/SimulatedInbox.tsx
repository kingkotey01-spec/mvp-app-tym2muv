import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { 
  getSimulatedEmails, 
  markEmailAsRead, 
  clearAllSimulatedEmails, 
  sendWelcomeComms,
  SimulatedEmail 
} from '../services/notificationSimulator';
import { useAuth } from '../context/AuthContext';

const SimulatedInbox: React.FC = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<SimulatedEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<SimulatedEmail | null>(null);
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  
  // Custom trigger inputs
  const [customName, setCustomName] = useState(user?.name || '');
  const [customEmail, setCustomEmail] = useState(user?.email || 'kingkotey01@gmail.com');
  const [customRole, setCustomRole] = useState<'Tenant' | 'Agent' | 'Customer'>('Tenant');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadEmails = () => {
    const list = getSimulatedEmails();
    setEmails(list);
    if (list.length > 0 && !selectedEmail) {
      setSelectedEmail(list[0]);
    }
  };

  useEffect(() => {
    loadEmails();

    const handleEmailsUpdate = () => {
      const list = getSimulatedEmails();
      setEmails(list);
      // Auto-select first email if none selected
      if (list.length > 0) {
        if (!selectedEmail || !list.find(e => e.id === selectedEmail.id)) {
          setSelectedEmail(list[0]);
        } else {
          // Sync state
          const updatedSelected = list.find(e => e.id === selectedEmail.id);
          if (updatedSelected) setSelectedEmail(updatedSelected);
        }
      } else {
        setSelectedEmail(null);
      }
    };

    window.addEventListener('tym2muv_emails_updated', handleEmailsUpdate);
    return () => {
      window.removeEventListener('tym2muv_emails_updated', handleEmailsUpdate);
    };
  }, [selectedEmail]);

  const handleSelectEmail = (email: SimulatedEmail) => {
    setSelectedEmail(email);
    if (!email.read) {
      markEmailAsRead(email.id);
    }
  };

  const handleClear = () => {
    clearAllSimulatedEmails();
    setSelectedEmail(null);
  };

  const handleTriggerWelcome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customName) return;

    sendWelcomeComms(customEmail, customName, customRole);
    setSuccessMsg('⚡ Welcome handshake initialized! Welcome Email dispatched to inbox and Welcome In-App Notification pushed to bell tray!');
    
    setTimeout(() => {
      setSuccessMsg(null);
    }, 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alert message */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-2.5 shadow-sm animate-slide-up">
          <Icon name="check" size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Manual Tester Panel */}
      <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600">
            <Icon name="key" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 font-display">Custom Welcome Notification & Email Dispatcher</h3>
            <p className="text-xs text-slate-500">Initiate a secure registration handshake simulation using arbitrary inputs.</p>
          </div>
        </div>

        <form onSubmit={handleTriggerWelcome} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Recipient Name</label>
            <input 
              type="text" 
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Kofi Annan"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Recipient Email</label>
            <input 
              type="email" 
              required
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="e.g. user@example.com"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Account Role type</label>
            <select
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium text-slate-800"
            >
              <option value="Tenant">Tenant</option>
              <option value="Agent">Agent</option>
              <option value="Customer">Customer</option>
            </select>
          </div>
          <div>
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white font-bold py-2.5 rounded-xl hover:shadow-lg hover:shadow-brand-500/20 transition-all font-sans text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Icon name="send" size={14} /> Dispatch Handshake 🔑
            </button>
          </div>
        </form>
      </div>

      {/* Inbox Split View / Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 font-display text-sm md:text-base">System Real-time Outbox Simulator</span>
            {emails.length > 0 && (
              <span className="bg-brand-55 mr-1 bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {emails.filter(e => !e.read).length} Unread
              </span>
            )}
          </div>
          
          {emails.length > 0 && (
            <button 
              onClick={handleClear}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <Icon name="trash" size={14} /> Clear Outbox
            </button>
          )}
        </div>

        {emails.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
            {/* List side */}
            <div className="lg:col-span-4 border-r border-slate-100 overflow-y-auto max-h-[550px] divide-y divide-slate-50">
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => handleSelectEmail(email)}
                  className={`w-full text-left p-4 hover:bg-slate-50/75 transition-colors block relative border-l-4 ${selectedEmail?.id === email.id ? 'bg-slate-50 border-brand-500' : 'border-transparent'} ${!email.read ? 'font-semibold' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 uppercase">From System</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h4 className="text-xs text-slate-900 truncate mb-1 pr-4">{email.subject}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{email.recipient}</p>
                  
                  {!email.read && (
                    <span className="absolute top-1/2 right-4 w-2 h-2 rounded-full bg-brand-500"></span>
                  )}
                </button>
              ))}
            </div>

            {/* Email Render View */}
            <div className="lg:col-span-8 flex flex-col bg-slate-50/20 max-h-[550px] overflow-y-auto">
              {selectedEmail ? (
                <div className="p-6 md:p-8 flex-1 flex flex-col">
                  {/* Email Headers */}
                  <div className="border-b border-slate-100 pb-5 mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-sm md:text-base font-bold text-slate-900 tracking-tight font-display mb-1">{selectedEmail.subject}</h2>
                        <div className="text-xs text-slate-500 font-medium">
                          From: <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-bold">{selectedEmail.sender}</span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          To: <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{selectedEmail.recipient}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1">
                        <button
                          onClick={() => setViewMode('html')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'html' ? 'bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Visual HTML
                        </button>
                        <button
                          onClick={() => setViewMode('text')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'text' ? 'bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Raw Template
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body container */}
                  <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 md:p-6 shadow-sm overflow-hidden min-h-[400px]">
                    {viewMode === 'html' ? (
                      <div 
                        dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }} 
                        className="w-full h-full overflow-y-auto border-0"
                      />
                    ) : (
                      <pre className="font-mono text-xs text-slate-600 overflow-auto whitespace-pre-wrap leading-relaxed max-h-[380px] select-all p-3 bg-slate-50 rounded-xl">
                        {selectedEmail.body}
                      </pre>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                  <Icon name="mail" size={48} className="text-slate-300 mb-2" />
                  <p className="text-slate-500 text-sm">Select an email from the left sidebar to render.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-24 text-center">
            <div className="inline-block p-6 bg-slate-50 rounded-full mb-4">
              <Icon name="mail" size={40} className="text-slate-300 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No emails simulated yet</h3>
            <p className="text-slate-500 mt-1 max-w-md mx-auto text-xs px-6">
              When a new user undergoes onboarding, their welcome handshake is captured and simulated here. Use the custom welcome dispatcher form above to trigger a test now!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulatedInbox;
