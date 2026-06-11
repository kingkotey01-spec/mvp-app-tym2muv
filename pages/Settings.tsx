import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { updateUserProfile, uploadImage } from '../services/supabaseService';
import Icon from '../components/Icon';
import { useNavigate } from 'react-router-dom';

const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    phone: '',
    location: '',
    avatar: '',
    agencyName: '',
    businessEmail: '',
    businessWebsite: '',
    businessWhatsApp: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        phone: user.socials?.phone || '',
        location: user.location || '',
        avatar: user.avatar || '',
        agencyName: user.agencyName || '',
        businessEmail: user.socials?.email || '',
        businessWebsite: user.socials?.website || '',
        businessWhatsApp: user.socials?.whatsapp || ''
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      setIsSubmitting(true);
      try {
        const url = await uploadImage(file, `avatars/${user.id}/${Date.now()}_${file.name}`);
        setFormData(prev => ({ ...prev, avatar: url }));
        toast('Profile picture uploaded!', 'success');
      } catch (error) {
        console.error("Error uploading avatar:", error);
        toast("Failed to upload image. Please try again.", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      await updateUserProfile(user.id, {
        name: formData.name,
        bio: formData.bio,
        location: formData.location,
        avatar: formData.avatar,
        agencyName: formData.agencyName,
        socials: {
          ...(user.socials || {}),
          phone: formData.phone,
          email: formData.businessEmail,
          website: formData.businessWebsite,
          whatsapp: formData.businessWhatsApp
        }
      });
      await refreshUser();
      toast("Profile updated successfully!", "success");
      navigate(`/profile/${user.id}`);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast("Failed to update profile. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-3 max-w-md min-h-screen">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
          <Icon name="chevronRight" size={16} className="rotate-180" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Profile Settings</h1>
      </div>

      <div className="glass-card rounded-2xl p-4 shadow-md border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-2">
            <div className="relative group">
              <img 
                src={formData.avatar || 'https://via.placeholder.com/150'} 
                alt="Profile" 
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md bg-slate-100"
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Icon name="camera" size={14} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Click to change photo</p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Full Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none bg-white/60"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Phone Number</label>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none bg-white/60"
                placeholder="+233..."
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Location</label>
              <input 
                type="text" 
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none bg-white/60"
                placeholder="City, Country"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Bio</label>
              <textarea 
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={2}
                className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none bg-white/60 animate-none resize-none"
                placeholder="Tell us about yourself..."
              ></textarea>
            </div>

            {/* Vendor Business details (only shown for vendor accounts) */}
            {(user.role === 'Agent' || user.role === 'Admin') && (
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-150 space-y-2.5 animate-slide-up">
                <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
                  <Icon name="building" size={12} className="text-brand-600" />
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Business Details (Vendor Only)</span>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Business Name / Agency Name</label>
                  <input 
                    type="text" 
                    name="agencyName"
                    value={formData.agencyName}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    placeholder="e.g. Acme Properties Ltd"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Business Email</label>
                  <input 
                    type="email" 
                    name="businessEmail"
                    value={formData.businessEmail}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    placeholder="e.g. contact@yourbusiness.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Business Website URL</label>
                  <input 
                    type="url" 
                    name="businessWebsite"
                    value={formData.businessWebsite}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    placeholder="e.g. www.yourbusiness.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Business WhatsApp Number</label>
                  <input 
                    type="tel" 
                    name="businessWhatsApp"
                    value={formData.businessWhatsApp}
                    onChange={handleChange}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    placeholder="e.g. +233241234567"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-600 text-white py-2 px-4 rounded-xl font-bold hover:bg-brand-700 text-xs shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Icon name="check" size={16} />
              )}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
