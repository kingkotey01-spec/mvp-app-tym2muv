import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserRole, updateUserProfile } from '../services/supabaseService';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { motion } from 'framer-motion';

const SPECIALIZATIONS = [
  'Residential Rentals',
  'Commercial Sales',
  'Affordable Housing',
  'Luxury Estates',
  'Property Management',
  'Land Sales',
  'Short-let Apartments',
  'Developer Partnerships'
];

const CreateVendor: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    agencyName: '',
    location: '',
    bio: '',
    licenseNumber: ''
  });

  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.socials?.phone || '',
        agencyName: '',
        location: user.location !== 'Unknown' ? user.location : '',
        bio: user.bio || '',
        licenseNumber: ''
      });
      
      // If they are already Agent or Admin, they don't need to create a vendor account
      if (user.role === 'Agent' || user.role === 'Admin') {
        navigate('/post');
      }
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSpecialization = (spec: string) => {
    setSelectedSpecializations(prev => 
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.phone) {
      setError('A professional phone number is required so clients can contact you.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Update the user profile with the fields (including phone inside socials)
      await updateUserProfile(user.id, {
        name: formData.name,
        bio: formData.bio,
        location: formData.location,
        agencyName: formData.agencyName,
        socials: {
          ...user.socials,
          phone: formData.phone,
          website: formData.agencyName ? `https://tym2muv.com/agent/${user.id}` : undefined
        }
      });

      // 2. Perform any additional metadata updates or direct Supabase inserts if necessary
      // For standard setup in tym2muv, setting the role to 'Agent' is the primary trigger.
      // We will update the role in profiles setting it to 'Agent'
      await updateUserRole(user.id, 'Agent');

      // 3. Optional extra step: We can save extra agent metadata into profiles or agency columns if any exist.
      // Since 'profiles' table stores most fields, we'll run a custom update for agency_name or license if the columns are there, 
      // or we can just save agency_name inside the bio/meta
      
      // Bust the profile cache so the new 'Agent' role is fetched fresh
      // (delCache is called inside updateUserRole, but refreshUser uses the supabase
      //  session directly and may pull a stale in-memory cache entry)
      await refreshUser();

      // Small delay so AuthContext re-renders with the new role before PostAd checks it
      await new Promise(res => setTimeout(res, 300));

      // Redirect directly to the post-ad page!
      navigate('/post', { replace: true });
    } catch (err: any) {
      console.error('Error creating vendor account:', err);
      setError(err?.message || 'Failed to initialize vendor account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Icon name="loader" size={40} className="animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 px-3 bg-slate-50/50">
      <div className="max-w-xl mx-auto">
        <div className="mb-3">
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Icon name="arrowLeft" size={14} className="transition-transform group-hover:-translate-x-1" />
            Back
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100"
        >
          <div className="text-center mb-3.5">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-1.5 border border-brand-100 shadow-sm">
              <Icon name="briefcase" size={20} className="text-brand-600" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-sans">Become a Vendor</h1>
            <p className="text-slate-500 text-[11px] mt-0.5 max-w-sm mx-auto">
              Ready to list properties and reach thousands of daily clients? Create a vendor/agent account in seconds.
            </p>
          </div>

          {error && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[11px] font-semibold flex items-center gap-2">
              <Icon name="alert" size={13} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider mb-1">Display Name</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Jane Doe"
                  className="w-full border border-slate-200/80 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider mb-1">Professional Phone</label>
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="e.g. +233..."
                  className="w-full border border-slate-200/80 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider mb-1">Agency Name (Optional)</label>
                <input 
                  type="text" 
                  name="agencyName"
                  value={formData.agencyName}
                  onChange={handleChange}
                  placeholder="e.g. Premium Real Estate"
                  className="w-full border border-slate-200/80 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider mb-1">Service City / Region</label>
                <input 
                  type="text" 
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Accra, Ghana"
                  className="w-full border border-slate-200/80 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider mb-1">Areas of Specialization</label>
              <div className="flex flex-wrap gap-1">
                {SPECIALIZATIONS.map((spec) => {
                  const isSelected = selectedSpecializations.includes(spec);
                  return (
                    <button
                      type="button"
                      key={spec}
                      onClick={() => toggleSpecialization(spec)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                        isSelected 
                          ? 'bg-brand-600 border-brand-600 text-white shadow-none' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {spec}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider mb-1">Professional Bio</label>
              <textarea 
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={2}
                placeholder="Describe your experience, customer commitment, or services..."
                className="w-full border border-slate-200/80 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none"
              ></textarea>
            </div>

            <div className="pt-1.5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 hover:shadow-xs transition-all flex items-center justify-center gap-1.5 shadow-none disabled:opacity-50 text-xs"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Icon name="shieldCheck" size={13} />
                    <span>Create Vendor Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateVendor;
