import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserRole, updateUserProfile, upsertAgentProfile } from '../services/supabaseService';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useToast } from '../components/Toast';

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

// Zod validation schema for agent onboarding
const createVendorSchema = z.object({
  name: z.string()
    .min(2, { message: "Display name must be at least 2 characters." })
    .max(50, { message: "Display name cannot exceed 50 characters." }),
  phone: z.string()
    .min(8, { message: "Professional phone must be at least 8 characters." })
    .max(20, { message: "Phone number cannot exceed 20 characters." })
    .regex(/^\+?[0-9\s\-()]+$/, { message: "Please provide a valid phone number (digits, spaces, or international format)." }),
  agencyName: z.string()
    .max(100, { message: "Agency name cannot exceed 100 characters." })
    .optional()
    .or(z.literal('')),
  location: z.string()
    .min(3, { message: "Service location must be at least 3 characters." })
    .max(100, { message: "Service location cannot exceed 100 characters." }),
  bio: z.string()
    .min(10, { message: "Professional bio is required (minimum 10 characters to attract high-quality clients)." })
    .max(300, { message: "Professional bio cannot exceed 300 characters." }),
  licenseNumber: z.string()
    .max(50, { message: "License/Registration number cannot exceed 50 characters." })
    .optional()
    .or(z.literal(''))
});

const CreateVendor: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
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
      const savedForm = localStorage.getItem(`create_vendor_form_${user.id}`);
      const savedSpecs = localStorage.getItem(`create_vendor_specs_${user.id}`);
      
      let initialForm = {
        name: (user.name && user.name.toLowerCase().trim() !== 'kotey') ? user.name : '',
        phone: user.socials?.phone || '',
        agencyName: user.agencyName || '',
        location: user.location !== 'Unknown' ? user.location : '',
        bio: user.bio || '',
        licenseNumber: user.licenseNumber || ''
      };

      if (savedForm) {
        try {
          const parsed = JSON.parse(savedForm);
          initialForm = {
            name: parsed.name !== undefined ? (parsed.name.toLowerCase().trim() === 'kotey' ? '' : parsed.name) : initialForm.name,
            phone: parsed.phone !== undefined ? parsed.phone : initialForm.phone,
            agencyName: parsed.agencyName !== undefined ? parsed.agencyName : initialForm.agencyName,
            location: parsed.location !== undefined ? parsed.location : initialForm.location,
            bio: parsed.bio !== undefined ? parsed.bio : initialForm.bio,
            licenseNumber: parsed.licenseNumber !== undefined ? parsed.licenseNumber : initialForm.licenseNumber
          };
        } catch (_) {}
      }
      setFormData(initialForm);
      
      let initialSpecs = user.specialization && Array.isArray(user.specialization)
        ? user.specialization
        : [];

      if (savedSpecs) {
        try {
          initialSpecs = JSON.parse(savedSpecs);
        } catch (_) {}
      }
      setSelectedSpecializations(initialSpecs);
      
      // If they are already Agent or Admin, they don't need to create a vendor account
      // UNLESS they haven't completed their vendor profile setup yet (e.g., bio or phone page parameters/details are absent).
      const hasCompletedVendorProfile = user.bio && user.location && user.location !== 'Unknown' && user.socials?.phone;
      if (user.role === 'Admin' || (user.role === 'Agent' && hasCompletedVendorProfile)) {
        navigate('/agent-dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (user) {
        localStorage.setItem(`create_vendor_form_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    
    // Clear the error message to offer immediate pleasant visual response
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const toggleSpecialization = (spec: string) => {
    if (isSubmitting) return;
    setSelectedSpecializations(prev => {
      const updated = prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec];
      if (user) {
        localStorage.setItem(`create_vendor_specs_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    // Validate using Zod schema
    const validation = createVendorSchema.safeParse({
      name: formData.name,
      phone: formData.phone,
      agencyName: formData.agencyName,
      location: formData.location,
      bio: formData.bio,
      licenseNumber: formData.licenseNumber
    });

    if (!validation.success) {
      const errorsList: Record<string, string> = {};
      validation.error.issues.forEach(issue => {
        const path = issue.path[0];
        if (path !== undefined) {
          errorsList[String(path)] = issue.message;
        }
      });
      setFieldErrors(errorsList);
      setError('Please review the form. Some fields have invalid or incomplete information.');
      setIsSubmitting(false);
      
      // Toast the first error to attract immediate user awareness
      const firstError = validation.error.issues[0]?.message;
      if (firstError) {
        toast(firstError, "warning");
      }
      return;
    }

    try {
      // 1. Update the user profile with the fields (including phone/license/specializations inside socials for fallbacks)
      await updateUserProfile(user.id, {
        name: formData.name,
        bio: formData.bio,
        location: formData.location,
        agencyName: formData.agencyName,
        licenseNumber: formData.licenseNumber,
        specialization: selectedSpecializations,
        socials: {
          ...user.socials,
          phone: formData.phone,
          website: formData.agencyName ? `https://tym2muv.com/agent/${user.id}` : undefined
        }
      });

      // 2. Perform role upgrade to 'Agent'
      await updateUserRole(user.id, 'Agent');

      // 2.5 Upsert agent-specific profile details into agents table
      await upsertAgentProfile(user.id, { company_name: formData.agencyName });
 
      // Refresh AuthContext session details
      await refreshUser();

      // Clear draft states from localStorage upon successful registration
      localStorage.removeItem(`create_vendor_form_${user.id}`);
      localStorage.removeItem(`create_vendor_specs_${user.id}`);

      // Delay briefly for auth state updates to take hold
      await new Promise(res => setTimeout(res, 400));

      // 3. Show success Toast and redirect straight to the Agent Dashboard!
      toast("Congratulations! Your Premium Vendor Account has been activated successfully.", "success");
      navigate('/agent-dashboard', { replace: true });
    } catch (err: any) {
      console.error('Error creating vendor account:', err);
      setError(err?.message || 'Failed to initialize vendor account. Please verify input data and try again.');
      toast(err?.message || 'Failed to activate vendor profile. Please try again.', 'error');
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
            disabled={isSubmitting}
            className="group flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
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
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-1.5 border border-brand-100 shadow-sm animate-pulse">
              <Icon name="briefcase" size={20} className="text-brand-600" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-sans">Become a Vendor</h1>
            <p className="text-slate-500 text-[11px] mt-0.5 max-w-sm mx-auto">
              Ready to list properties and reach thousands of daily clients? Create a vendor/agent account in seconds.
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2 bg-slate-100/85 text-slate-600 text-[9px] font-bold py-1 px-2.5 rounded-full w-fit mx-auto shadow-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>DRAFT AUTO-SAVED IN REAL TIME</span>
            </div>
          </div>

          {error && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[11px] font-semibold flex items-center gap-2">
              <Icon name="alert" size={13} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            {/* Soft backdrop lock overlay during submit requests */}
            {isSubmitting && (
              <div className="absolute inset-0 bg-white/40 z-10 rounded-2xl backdrop-blur-[1px] cursor-not-allowed"></div>
            )}

            <fieldset disabled={isSubmitting} className="space-y-3">
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
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.name ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80'}`}
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                      <Icon name="alert" size={10} />
                      {fieldErrors.name}
                    </p>
                  )}
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
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.phone ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80'}`}
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                      <Icon name="alert" size={10} />
                      {fieldErrors.phone}
                    </p>
                  )}
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
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.agencyName ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80'}`}
                  />
                  {fieldErrors.agencyName && (
                    <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                      <Icon name="alert" size={10} />
                      {fieldErrors.agencyName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider mb-1">Professional License # (Optional)</label>
                  <input 
                    type="text" 
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    placeholder="e.g. RE-190283"
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.licenseNumber ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80'}`}
                  />
                  {fieldErrors.licenseNumber && (
                    <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                      <Icon name="alert" size={10} />
                      {fieldErrors.licenseNumber}
                    </p>
                  )}
                </div>
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
                  className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.location ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80'}`}
                />
                {fieldErrors.location && (
                  <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                    <Icon name="alert" size={10} />
                    {fieldErrors.location}
                  </p>
                )}
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black text-slate-750 uppercase tracking-wider">Professional Bio</label>
                  <span className={`text-[9px] font-bold tracking-tight px-1.5 py-0.5 rounded ${
                    formData.bio.length > 300 
                      ? 'bg-red-50 text-red-500 border border-red-100' 
                      : formData.bio.length < 10 
                      ? 'bg-amber-50 text-amber-600 border border-amber-100'
                      : 'bg-slate-100 text-slate-450'
                  }`}>
                    {formData.bio.length} / 300 chars
                  </span>
                </div>
                <textarea 
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe your real estate experience, customer commitment, properties specialized in, or services..."
                  className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none resize-none ${fieldErrors.bio ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80'}`}
                ></textarea>
                {fieldErrors.bio && (
                  <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                    <Icon name="alert" size={10} />
                    {fieldErrors.bio}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 hover:shadow-md hover:shadow-brand-500/10 transition-all flex items-center justify-center gap-1.5 shadow-none disabled:opacity-50 text-xs"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Activating Profile...</span>
                    </div>
                  ) : (
                    <>
                      <Icon name="shieldCheck" size={13} />
                      <span>Create Vendor Profile</span>
                    </>
                  )}
                </button>
              </div>
            </fieldset>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateVendor;
