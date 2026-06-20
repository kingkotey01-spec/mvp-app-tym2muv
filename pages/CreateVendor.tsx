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
  const [submissionError, setSubmissionError] = useState<{
    title: string;
    message: string;
    suggestion: string;
  } | null>(null);
  
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
      if (user.role === 'Admin' || user.role === 'Agent') {
        navigate('/agent-dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const validateField = (fieldName: string, value: string) => {
    let err = '';
    if (fieldName === 'name') {
      if (!value.trim()) {
        err = 'Display name is required.';
      } else if (value.trim().length < 2) {
        err = 'Display name must be at least 2 characters.';
      } else if (value.length > 50) {
        err = 'Display name cannot exceed 50 characters.';
      }
    } else if (fieldName === 'phone') {
      if (!value.trim()) {
        err = 'Professional phone number is required.';
      } else if (value.trim().length < 8) {
        err = 'Professional phone must be at least 8 characters.';
      } else if (value.length > 20) {
        err = 'Phone number cannot exceed 20 characters.';
      } else if (!/^\+?[0-9\s\-()]+$/.test(value)) {
        err = 'Please provide a valid phone number (digits, spaces, or international format).';
      }
    } else if (fieldName === 'location') {
      if (!value.trim()) {
        err = 'Service location is required.';
      } else if (value.trim().length < 3) {
        err = 'Service location must be at least 3 characters.';
      } else if (value.length > 100) {
        err = 'Service location cannot exceed 100 characters.';
      }
    } else if (fieldName === 'bio') {
      if (!value.trim()) {
        err = 'Professional bio is required.';
      } else if (value.trim().length < 10) {
        err = 'Professional bio is required (minimum 10 characters to attract high-quality clients).';
      } else if (value.length > 300) {
        err = 'Professional bio cannot exceed 300 characters.';
      }
    } else if (fieldName === 'agencyName') {
      if (value && value.length > 100) {
        err = 'Agency name cannot exceed 100 characters.';
      }
    } else if (fieldName === 'licenseNumber') {
      if (value && value.length > 50) {
        err = 'License/Registration number cannot exceed 50 characters.';
      }
    }

    setFieldErrors(prev => ({
      ...prev,
      [fieldName]: err
    }));

    return !err;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    validateField(name, value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (user) {
        localStorage.setItem(`create_vendor_form_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    
    // Clear display errors as they begin typing again
    setError(null);
    setSubmissionError(null);
    
    if (fieldErrors[name]) {
      validateField(name, value);
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

  const parseSupabaseError = (err: any) => {
    console.error('Submission failed with full error details:', err);
    
    // Default fallback
    const res = {
      title: 'Submission Failed',
      message: err?.message || 'Failed to initialize vendor account. Please verify input data and try again.',
      suggestion: 'Please verify your details or network connection and try again.'
    };

    if (!err) return res;

    // Check code or message
    const code = String(err.code || '');
    const msg = String(err.message || '').toLowerCase();
    
    if (code === '42501' || msg.includes('permission denied') || msg.includes('insufficient_privilege') || msg.includes('policy')) {
      res.title = 'Access Denied (Security Policy Restriction)';
      res.message = 'The database Row-Level Security policy prevented updating this profile or role catalog.';
      res.suggestion = 'Ensure you are signed in as the correct user. If you recently updated your profile, try signing out and signing in again to refresh your security cookies.';
    } else if (code === '23505' || msg.includes('unique violation') || msg.includes('duplicate key') || msg.includes('already exists')) {
      res.title = 'Registration Conflict';
      res.message = 'A custom record with similar fields (e.g. phone number or account ID) is already registered.';
      res.suggestion = 'Please double-check your Professional Phone or agency credentials. Each vendor profile must operate with a distinct phone number.';
    } else if (code === '42P01' || msg.includes('relation') || msg.includes('does not exist')) {
      res.title = 'Database Table Missing';
      res.message = 'The required database table structure was not found on the server.';
      res.suggestion = 'This represents a systems migration issue. Your inputs are valid, but database tables under Supabase might be upgrading. Please contact support.';
    } else if (msg.includes('jwt') || msg.includes('token expired') || msg.includes('auth') || msg.includes('api key')) {
      res.title = 'Session Verification Expired';
      res.message = 'Your authentication state expired while negotiating promotion tokens.';
      res.suggestion = 'Please perform a page reload, or log out of your current session and sign back in to establish a healthy connection.';
    } else if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('connection refused')) {
      res.title = 'Inbound Network Disruption';
      res.message = 'An error occurred while establishing a stable socket connection with database nodes.';
      res.suggestion = 'Check that your network is alive and that no firewall is blocking HTTPS traffic to our database clusters. Try clicking submit once more.';
    } else if (msg.includes('validation') || msg.includes('invalid input')) {
      res.title = 'Input Verification Error';
      res.message = 'The database rejected schema insertion due to malformed values.';
      res.suggestion = 'Make sure there are no illegal emojis or excessive special symbols inside the text boxes, then try submitting again.';
    }

    return res;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    setSubmissionError(null);
    setFieldErrors({});

    // 1. Front-end Required Fields Validation
    let hasFieldErrors = false;
    const fieldsToValidate = ['name', 'phone', 'location', 'bio', 'agencyName', 'licenseNumber'];
    fieldsToValidate.forEach(field => {
      const isValid = validateField(field, formData[field as keyof typeof formData]);
      if (!isValid) {
        hasFieldErrors = true;
      }
    });

    if (hasFieldErrors) {
      setError('Please review the form. Some required or formatted fields have invalid data.');
      setIsSubmitting(false);
      toast('Please correct the highlighted fields in the form.', 'warning');
      return;
    }

    // 2. Validate using Zod schema for full coverage
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
      setError('Validation failed. Some fields contain invalid or inappropriate formats.');
      setIsSubmitting(false);
      
      const firstError = validation.error.issues[0]?.message;
      if (firstError) {
        toast(firstError, "warning");
      }
      return;
    }

    try {
      // 1. Update the user profile with the fields
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

      // 2.5 Upsert agent-specific profile details into agents table defensively
      try {
        await upsertAgentProfile(user.id, { company_name: formData.agencyName });
      } catch (agentErr) {
        console.warn('Non-fatal warning: failed to upsert premium company details into agents table:', agentErr);
      }
 
      // Refresh AuthContext session details
      await refreshUser();

      // Clear draft states from localStorage upon successful registration
      localStorage.removeItem(`create_vendor_form_${user.id}`);
      localStorage.removeItem(`create_vendor_specs_${user.id}`);

      // Delay briefly for auth state updates to take hold
      await new Promise(res => setTimeout(res, 450));

      // 3. Show success Toast and redirect straight to the Agent Dashboard!
      toast("Congratulations! Your Premium Vendor Account has been activated successfully.", "success");
      navigate('/agent-dashboard', { replace: true });
    } catch (err: any) {
      console.error('Error creating vendor account:', err);
      const parsedError = parseSupabaseError(err);
      setSubmissionError(parsedError);
      setError(parsedError.message);
      toast(parsedError.message, 'error');
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

          {submissionError && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs flex flex-col gap-1.5 shadow-none">
              <div className="flex items-center gap-2 text-red-800 font-bold">
                <Icon name="alert" size={15} />
                <span>{submissionError.title}</span>
              </div>
              <p className="text-red-650 leading-relaxed font-medium">
                {submissionError.message}
              </p>
              <div className="text-[10px] bg-red-100/40 text-red-850 p-2 rounded-lg font-semibold border border-red-100/60 mt-0.5 leading-relaxed">
                <span className="font-bold block text-[9px] uppercase tracking-wider text-red-900 mb-0.5">Troubleshooting TIP:</span>
                {submissionError.suggestion}
              </div>
            </div>
          )}

          {error && !submissionError && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-red-50 border border-red-100 text-red-650 text-[11px] font-semibold flex items-center gap-2 shadow-none">
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
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Name <span className="text-red-500" title="Required field">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    placeholder="e.g. Jane Doe"
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.name ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80 hover:border-slate-300'}`}
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                      <Icon name="alert" size={10} />
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Professional Phone <span className="text-red-500" title="Required field">*</span>
                  </label>
                  <input 
                    type="tel" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    placeholder="e.g. +233..."
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.phone ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80 hover:border-slate-300'}`}
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
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Agency Name (Optional)</label>
                  <input 
                    type="text" 
                    name="agencyName"
                    value={formData.agencyName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g. Premium Real Estate"
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.agencyName ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80 hover:border-slate-300'}`}
                  />
                  {fieldErrors.agencyName && (
                    <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                      <Icon name="alert" size={10} />
                      {fieldErrors.agencyName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Professional License # (Optional)</label>
                  <input 
                    type="text" 
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="e.g. RE-190283"
                    className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.licenseNumber ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80 hover:border-slate-300'}`}
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
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Service City / Region <span className="text-red-500" title="Required field">*</span>
                </label>
                <input 
                  type="text" 
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  placeholder="e.g. Accra, Ghana"
                  className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none ${fieldErrors.location ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80 hover:border-slate-300'}`}
                />
                {fieldErrors.location && (
                  <p className="mt-1 text-[9px] text-red-500 font-bold flex items-center gap-1 leading-none">
                    <Icon name="alert" size={10} />
                    {fieldErrors.location}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Areas of Specialization</label>
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
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Professional Bio <span className="text-red-500" title="Required field">*</span>
                  </label>
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
                  onBlur={handleBlur}
                  required
                  rows={3}
                  placeholder="Describe your real estate experience, customer commitment, properties specialized in, or services..."
                  className={`w-full border rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-brand-500 outline-none bg-white font-medium text-xs transition-colors shadow-none resize-none ${fieldErrors.bio ? 'border-red-500 focus:ring-red-500 bg-red-50/10' : 'border-slate-200/80 hover:border-slate-300'}`}
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
