import React, { useState, useEffect } from 'react';
import { 
  getRentFinancingApplications, 
  updateRentFinancingApplication,
  createNotification
} from '../services/supabaseService';
import { RentFinancingApplication } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import { 
  Users, 
  DollarSign, 
  Percent, 
  Building, 
  User, 
  TrendingUp, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  ArrowRight, 
  Briefcase, 
  ShieldCheck, 
  Calendar,
  Lock,
  Download,
  Activity,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useToast } from './Toast';

const RADIAN = Math.PI / 180;
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

interface AdminRentFinancingProps {
  userLocation: {
    symbol: string;
    country: string;
  };
}

export const AdminRentFinancing: React.FC<AdminRentFinancingProps> = ({ userLocation }) => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<RentFinancingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<RentFinancingApplication | null>(null);
  
  // Modal & interactive admin states
  const [adminNotesText, setAdminNotesText] = useState('');
  const [modifiedAmount, setModifiedAmount] = useState<number>(0);
  const [modifiedDuration, setModifiedDuration] = useState<number>(12);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load applications
  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch DB applications
      let dbApps: RentFinancingApplication[] = [];
      try {
        dbApps = await getRentFinancingApplications();
      } catch (err) {
        console.warn("Supabase query bypass, loading local state and fallback mocks.");
      }

      // Sync with localStorage
      const localStored = localStorage.getItem('rent_financing_local');
      const parsedLocal = localStored ? JSON.parse(localStored) : [];
      
      const seedApps: RentFinancingApplication[] = [
        {
          id: 'RF-9042',
          fullName: 'David Mensah',
          email: 'david.mensah@email.com',
          phone: '+233 24 990 1234',
          employmentStatus: 'employed',
          monthlyIncome: 6500,
          idType: 'national_id',
          idNumber: 'GHA-782390142-1',
          monthlyRent: 1500,
          landlordName: 'Alhaji Kwesi',
          landlordPhone: '+233 24 987 6543',
          moveInDate: '2026-07-01',
          leaseDuration: 12,
          streetAddress: 'Ring Road Central, Plot 42',
          city: 'Accra',
          stateRegion: 'Greater Accra',
          country: 'GH',
          amountRequired: 18000,
          repaymentDuration: 12,
          status: 'approved',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          adminNotes: 'Income verification successful. Lease agreement signed by landlord. First month advance completely paid up. Disbursement processed.'
        },
        {
          id: 'RF-8193',
          fullName: 'Patricia Osei',
          email: 'patricia@gmail.com',
          phone: '+233 55 120 4421',
          employmentStatus: 'employed',
          monthlyIncome: 4200,
          idType: 'passport',
          idNumber: 'GHA-001239921',
          monthlyRent: 1800,
          landlordName: 'Mr. Emmanuel Ofori',
          landlordPhone: '+233 20 555 1122',
          moveInDate: '2026-06-30',
          leaseDuration: 12,
          streetAddress: 'Osu Oxford Street, Apt B2',
          city: 'Accra',
          stateRegion: 'Greater Accra',
          country: 'GH',
          amountRequired: 21600,
          repaymentDuration: 12,
          status: 'rejected',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          adminNotes: 'Debt-To-Income (DTI) ratio exceeds our 45% stress limit. Target rent ($1,800/mo) is too high relative to net salary ($4,200/mo). Suggest linking a co-signer or target homes below $1,200/mo.'
        },
        {
          id: 'RF-5120',
          fullName: 'Eben Lamptey',
          email: 'eben.lamptey@mail.com',
          phone: '+233 27 741 8933',
          employmentStatus: 'self_employed',
          monthlyIncome: 9000,
          idType: 'national_id',
          idNumber: 'GHA-892110214-7',
          monthlyRent: 2200,
          landlordName: 'Madam Rita Appiah',
          landlordPhone: '+233 24 333 4445',
          moveInDate: '2026-07-15',
          leaseDuration: 12,
          streetAddress: 'Cantonments Drive, Block C',
          city: 'Accra',
          stateRegion: 'Greater Accra',
          country: 'GH',
          amountRequired: 26400,
          repaymentDuration: 18,
          status: 'under_review',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          adminNotes: 'Application received. Phone confirmation with landlord pending. Financial verification logs indicate healthy bank inflows.'
        },
        {
          id: 'RF-3051',
          fullName: 'Grace Addo',
          email: 'grace.addo@ymail.com',
          phone: '+233 24 455 6677',
          employmentStatus: 'employed',
          monthlyIncome: 3500,
          idType: 'drivers_license',
          idNumber: 'DL-908129-C',
          monthlyRent: 1100,
          landlordName: 'Ebenezer Laryea',
          landlordPhone: '+233 20 111 0002',
          moveInDate: '2026-08-01',
          leaseDuration: 12,
          streetAddress: 'Spintex Road, Behind Palace Mall',
          city: 'Accra',
          stateRegion: 'Greater Accra',
          country: 'GH',
          amountRequired: 13200,
          repaymentDuration: 12,
          status: 'incomplete',
          createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
          adminNotes: 'Missing 3-month bank statements. Your salary slips have been verified, but bank account verification is outstanding. Please re-upload or upload statements to complete review.'
        }
      ];

      const combined = [...parsedLocal, ...dbApps, ...seedApps];
      const uniqueApps = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      setApplications(uniqueApps);
    } catch (_) {
      toast("Error loading data. Showing offline local cache.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync selected application inputs when clicked
  useEffect(() => {
    if (selectedApp) {
      setAdminNotesText(selectedApp.adminNotes || '');
      setModifiedAmount(selectedApp.amountRequired);
      setModifiedDuration(selectedApp.repaymentDuration);
    }
  }, [selectedApp]);

  // Analytics helper variables
  const totalAppsCount = applications.length;
  const approvedApps = applications.filter(x => x.status === 'approved');
  const pendingApps = applications.filter(x => x.status === 'under_review' || x.status === 'pending');
  const rejectedApps = applications.filter(x => x.status === 'rejected');
  const incompleteApps = applications.filter(x => x.status === 'incomplete');

  const totalRequestedFunding = applications.reduce((acc, app) => acc + app.amountRequired, 0);
  const totalApprovedFunding = approvedApps.reduce((acc, app) => acc + app.amountRequired, 0);
  const avgDTI = applications.length > 0 
    ? Math.round(applications.reduce((acc, app) => acc + (app.monthlyRent / app.monthlyIncome), 0) / applications.length * 100)
    : 0;
  const totalProjectedInterest = Math.round(totalApprovedFunding * 0.015 * 12); // Average 12m term with 1.5% interest

  // Recharts Data Prep
  const pieData = [
    { name: 'Approved', value: approvedApps.length },
    { name: 'Under Review', value: pendingApps.length },
    { name: 'Incomplete', value: incompleteApps.length },
    { name: 'Rejected', value: rejectedApps.length }
  ].filter(item => item.value > 0);

  // Rental volume over time simulation
  const trendData = [
    { month: 'Jan', volume: Math.round(totalApprovedFunding * 0.15) },
    { month: 'Feb', volume: Math.round(totalApprovedFunding * 0.25) },
    { month: 'Mar', volume: Math.round(totalApprovedFunding * 0.40) },
    { month: 'Apr', volume: Math.round(totalApprovedFunding * 0.65) },
    { month: 'May', volume: Math.round(totalApprovedFunding * 0.85) },
    { month: 'Jun', volume: totalApprovedFunding }
  ];

  // Pipeline summary
  const pipelineData = [
    { stage: 'Tenant Request', count: totalAppsCount, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { stage: 'In Verification', count: pendingApps.length + approvedApps.length, bg: 'bg-amber-50 text-amber-600 border-amber-100' },
    { stage: 'Disbursed Escrow', count: approvedApps.length, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' }
  ];

  const handleUpdateApplication = async (newStatus: 'pending' | 'approved' | 'rejected' | 'under_review' | 'incomplete') => {
    if (!selectedApp) return;
    setIsUpdatingStatus(true);
    
    try {
      const updatedApp = {
        ...selectedApp,
        status: newStatus,
        adminNotes: adminNotesText,
        amountRequired: modifiedAmount,
        repaymentDuration: modifiedDuration
      };

      // 1. Write DB update
      try {
        await updateRentFinancingApplication(selectedApp.id, {
          status: newStatus,
          adminNotes: adminNotesText,
          amountRequired: modifiedAmount,
          repaymentDuration: modifiedDuration
        });
      } catch (_) {
        console.warn("DB offline. Using persistent localStorage buffer only.");
      }

      // 2. Write LocalStorage sync
      const localStored = localStorage.getItem('rent_financing_local');
      const parsedLocal = localStored ? JSON.parse(localStored) : [];
      const updatedLocal = parsedLocal.map((item: any) => 
        item.id === selectedApp.id ? { ...item, status: newStatus, adminNotes: adminNotesText, amountRequired: modifiedAmount, repaymentDuration: modifiedDuration } : item
      );
      
      // If not in local storage yet (it is a default mock app being modified on client-side), prepend it to capture edit state!
      if (!parsedLocal.find((x: any) => x.id === selectedApp.id)) {
        updatedLocal.unshift({
          ...selectedApp,
          status: newStatus,
          adminNotes: adminNotesText,
          amountRequired: modifiedAmount,
          repaymentDuration: modifiedDuration
        });
      }

      localStorage.setItem('rent_financing_local', JSON.stringify(updatedLocal));

      // 3. Update view states
      setApplications(prev => prev.map(a => a.id === selectedApp.id ? updatedApp : a));
      setSelectedApp(updatedApp);
      
      // Send notification to the applicant
      const targetUserId = selectedApp.userId || 'anonymous';
      if (targetUserId && targetUserId !== 'anonymous') {
        const formattedAmount = `${userLocation.symbol || 'GH¢'}${selectedApp.amountRequired.toLocaleString()}`;
        let title = '';
        let text = '';
        if (newStatus === 'approved') {
          title = 'Rent Financing Approved! 🎉';
          text = `Congratulations! Your rent financing application of ${formattedAmount} has been APPROVED. Disbursement has been queued to landlord ${selectedApp.landlordName}.`;
        } else if (newStatus === 'rejected') {
          title = 'Rent Financing Application Update ⚠️';
          text = `We regret to inform you that your rent financing application of ${formattedAmount} has been rejected. Please review our auditor notes for co-signing suggestions or alternatives.`;
        } else if (newStatus === 'under_review') {
          title = 'Rent Financing Under Review ⏳';
          text = `Your rent financing application of ${formattedAmount} is now under active review. Our loan officers will verify your landlord coordinates soon.`;
        } else if (newStatus === 'incomplete') {
          title = 'Documents Required for Rent Financing 📁';
          text = `Your rent financing application of ${formattedAmount} is marked as incomplete. Please upload your bank statements and payslip to proceed.`;
        }
        if (title && text) {
          await createNotification(targetUserId, title, text, '/rent-financing');
        }
      }

      toast(`Application ${selectedApp.id} status updated to ${newStatus.replace('_', ' ')}!`, 'success');
    } catch (err) {
      toast("Failed to update application status.", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSimulateDefaultRepayment = () => {
    if (!selectedApp) return;
    toast(`Simulated Repayment Collected! Ledger records credited ${userLocation.symbol}${Math.round(selectedApp.amountRequired / selectedApp.repaymentDuration).toLocaleString()} instantly.`, 'success');
  };

  // Filter application list
  const filteredApps = applications.filter(app => {
    const matchesSearch = 
      app.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.landlordName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pending') return matchesSearch && (app.status === 'under_review' || app.status === 'pending');
    return matchesSearch && app.status === filterStatus;
  });

  return (
    <div className="space-y-8">
      
      {/* SECTION 1: KEY ANALYTICS DASHBOARD & INSIGHTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total portfolio counts card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 mt-1">
              Active Program
            </span>
          </div>
          <h4 className="text-slate-400 font-medium text-xs mt-3 uppercase tracking-wider">Total Inflows</h4>
          <p className="text-2xl font-black text-slate-800 font-sans tracking-tight">{totalAppsCount} files</p>
          <div className="mt-2 text-[11px] text-slate-500 font-medium">
            <span className="font-bold text-blue-600">{pendingApps.length} pending</span> review files
          </div>
        </div>

        {/* Total Funding Allocated */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign size={20} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5 mt-1">
              100% Solid
            </span>
          </div>
          <h4 className="text-slate-400 font-medium text-xs mt-3 uppercase tracking-wider">Active Portfolio Out</h4>
          <p className="text-2xl font-black text-slate-800 font-sans tracking-tight">
            {userLocation.symbol}{totalApprovedFunding.toLocaleString()}
          </p>
          <div className="mt-2 text-[11px] text-slate-500 font-medium">
            Across <span className="font-bold text-emerald-600">{approvedApps.length} approved</span> families
          </div>
        </div>

        {/* Program Yield & Projected Interest */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Percent size={20} />
            </div>
            <span className="text-[10px] font-black text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full mt-1">
              +1.5% fixed fee
            </span>
          </div>
          <h4 className="text-slate-400 font-medium text-xs mt-3 uppercase tracking-wider">Projected Program Yield</h4>
          <p className="text-2xl font-black text-slate-800 font-sans tracking-tight">
            {userLocation.symbol}{totalProjectedInterest.toLocaleString()}
          </p>
          <div className="mt-2 text-[11px] text-slate-500 font-medium line-clamp-1">
            Expected yield from active contracts
          </div>
        </div>

        {/* Debt to Income stress level metrics */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
              <Activity size={20} />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${
              avgDTI <= 33 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                : 'bg-amber-50 border-amber-100 text-amber-600'
            }`}>
              {avgDTI <= 33 ? 'Healthy Risk' : 'High Leverage'}
            </span>
          </div>
          <h4 className="text-slate-400 font-medium text-xs mt-3 uppercase tracking-wider">Average DTI Score</h4>
          <p className="text-2xl font-black text-slate-800 font-sans tracking-tight">{avgDTI}% ratio</p>
          <div className="mt-2 text-[11px] text-slate-500 font-medium">
            Safe sector benchmark &lt; 33%
          </div>
        </div>

      </div>

      {/* CHARTS CONTAINER (Analytics insights & data) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph 1: Repayments / Rent Financing Outflows Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 leading-snug">
              <TrendingUp size={16} className="text-blue-500" />
              Capital Growth Trend
            </h4>
            <p className="text-[10px] font-medium text-slate-400">Total volume of disbursed rent advance capital in cumulative view</p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `${userLocation.symbol}${v}`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [`${userLocation.symbol}${value}`, 'Disbursed']} labelStyle={{ fontSize: 10, fontWeight: 'bold' }} contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Pipeline status breakdown pie */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 leading-snug">
              <Activity size={16} className="text-orange-500" />
              Status Pipeline Distribution
            </h4>
            <p className="text-[10px] font-medium text-slate-400">Total registered application states breakdown</p>
          </div>

          {pieData.length > 0 ? (
            <div className="h-[150px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-slate-400 text-xs font-mono font-bold">No application data</div>
          )}

          {/* Simple legend */}
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                <span>{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION 2: THE DETAILED APPLICATIONS MANAGER */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Table/List Filter Header Controls */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-[15px] leading-tight">Financing Pipeline Files</h3>
            <p className="text-[11px] font-medium text-slate-400">Review files, complete background credit checks, verify landlord accounts, write notes & sign payout escrow instructions</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search tenant name, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-705 placeholder:font-medium placeholder:text-slate-400 bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 border border-slate-250/60 bg-white rounded-xl px-2.5 py-1.5">
              <Filter size={11} className="text-slate-450 shrink-0" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs font-bold text-slate-700 outline-none pr-3 cursor-pointer bg-transparent"
              >
                <option value="all">All Files</option>
                <option value="pending">Under Review</option>
                <option value="approved">Approved</option>
                <option value="incomplete">Incomplete docs</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Applications List Component */}
        <div className="overflow-x-auto">
          {filteredApps.length === 0 ? (
            <div className="text-center p-12 space-y-2">
              <AlertCircle size={24} className="mx-auto text-slate-350" />
              <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wider">No matching applications</h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">No applicant files matched your active pipeline query checks. Ensure correct spelling or adjust stage filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="p-4">App ID</th>
                  <th className="p-4">Applicant</th>
                  <th className="p-4">Income Status</th>
                  <th className="p-4">Landlord details</th>
                  <th className="p-4">Funding Requested</th>
                  <th className="p-4">Risk ratio</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredApps.map(app => {
                  const relativeRentDTI = Math.round((app.monthlyRent / app.monthlyIncome) * 100);
                  const isDTIExceeded = relativeRentDTI > 40;
                  
                  return (
                    <tr 
                      key={app.id} 
                      className={`hover:bg-slate-50/50 transition-colors duration-150 cursor-pointer ${
                        selectedApp?.id === app.id ? 'bg-blue-50/20 border-l-2 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedApp(app)}
                    >
                      <td className="p-4 font-mono font-black text-slate-500">
                        <div>{app.id}</div>
                        {['RF-9042', 'RF-8193', 'RF-5120', 'RF-3051'].includes(app.id) && (
                          <span className="inline-block mt-1 text-[8px] bg-sky-50 text-sky-655 font-extrabold px-1.5 py-0.5 rounded border border-sky-100 uppercase tracking-widest leading-none">Sample Demo</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-extrabold text-slate-800 font-sans tracking-tight">{app.fullName}</span>
                          <span className="text-[10px] text-slate-405 font-medium">{app.email}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-extrabold text-slate-700 uppercase tracking-tight text-[10px]">{app.employmentStatus.replace('_', ' ')}</span>
                          <span className="text-[10px] text-slate-500 font-bold font-mono">{userLocation.symbol}{app.monthlyIncome.toLocaleString()} / mo</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-705">{app.landlordName}</span>
                          <span className="text-[10px] text-slate-405 font-mono">{app.landlordPhone}</span>
                        </div>
                      </td>
                      <td className="p-4 font-extrabold text-slate-800 font-mono">
                        {userLocation.symbol}{app.amountRequired.toLocaleString()}
                        <span className="block text-[9px] font-medium text-slate-400 lowercase italic">split {app.repaymentDuration}m</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-black ${
                          isDTIExceeded ? 'text-rose-500' : 'text-emerald-500'
                        }`}>
                          {relativeRentDTI}% DTI
                          {isDTIExceeded && <AlertCircle size={10} className="text-rose-400" />}
                        </span>
                      </td>
                      <td className="p-4">
                        {app.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                            approved
                          </span>
                        )}
                        {app.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                            rejected
                          </span>
                        )}
                        {(app.status === 'under_review' || app.status === 'pending') && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider scale-[0.98]">
                            pending review
                          </span>
                        )}
                        {app.status === 'incomplete' && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                            incomplete
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 font-extrabold text-[10px] rounded-lg transition-transform active:scale-95 lowercase cursor-pointer inline-flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApp(app);
                          }}
                        >
                          <span>Review file</span>
                          <ChevronRight size={10} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DETAILED APPLICANT REVIEW MODAL / DETAILS DRAWER */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[9990] flex justify-end animate-fade-in font-nunito">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            
            {/* Header section */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black font-mono text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">{selectedApp.id}</span>
                {['RF-9042', 'RF-8193', 'RF-5120', 'RF-3051'].includes(selectedApp.id) && (
                  <span className="text-[8px] bg-sky-50 text-sky-655 font-extrabold px-1.5 py-0.5 rounded border border-sky-100 uppercase tracking-widest leading-none">Sample Demo</span>
                )}
                <h3 className="font-extrabold text-slate-800 text-base">Credit File Review</h3>
              </div>
              <button 
                onClick={() => setSelectedApp(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-350 flex items-center justify-center text-slate-600 transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Scroll corridor */}
            <div className="flex-1 p-6 space-y-6">
              
              {/* Profile Block Summary */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#8607C1]/10 text-[#8607C1] flex items-center justify-center">
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{selectedApp.fullName}</h4>
                    <p className="text-[10px] text-slate-405 font-bold font-mono">Mobile: {selectedApp.phone} | Status: <span className="uppercase text-indigo-600">{selectedApp.employmentStatus.replace('_', ' ')}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-200/50 pt-3 text-[11px] leading-relaxed">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Tenant Reported Income</span>
                    <strong className="text-slate-800 text-xs font-mono font-black">{userLocation.symbol}{selectedApp.monthlyIncome.toLocaleString()} / mo</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Proposed Apartment Rent</span>
                    <strong className="text-slate-850 text-xs font-mono font-black">{userLocation.symbol}{selectedApp.monthlyRent.toLocaleString()} / mo</strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Landlord Info</span>
                    <strong className="text-slate-700 block">{selectedApp.landlordName}</strong>
                    <span className="text-[10px] text-slate-400 font-mono font-bold block">{selectedApp.landlordPhone}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Target Property Coordinates</span>
                    <strong className="text-slate-700 block">{selectedApp.streetAddress}</strong>
                    <span className="text-[10px] text-slate-400 font-bold block lowercase">{selectedApp.city}, {selectedApp.stateRegion}</span>
                  </div>
                </div>
              </div>

              {/* Stress Analysis Meter */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Affordability Stress Validation</h4>
                
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">Calculated Debt-To-Income (DTI)</span>
                    <span className={`font-mono font-black ${
                      (selectedApp.monthlyRent / selectedApp.monthlyIncome) > 0.33 ? 'text-rose-500' : 'text-emerald-500'
                    }`}>
                      {Math.round((selectedApp.monthlyRent / selectedApp.monthlyIncome) * 100)}% ratio
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        (selectedApp.monthlyRent / selectedApp.monthlyIncome) > 0.33 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.round((selectedApp.monthlyRent / selectedApp.monthlyIncome) * 100))}%` }}
                    />
                  </div>

                  <p className="text-[10px] leading-relaxed text-slate-500 lowercase font-medium">
                    {(selectedApp.monthlyRent / selectedApp.monthlyIncome) > 0.33 
                      ? "affordability threshold exceeded: target rent exceeds the optimal 33% stress limit. manual co-verifier check or high liquid evidence checks recommended."
                      : "affordability standards passed! index is low, which qualifies the tenant as a prime candidate for immediate automatic monthly payback terms."
                    }
                  </p>
                </div>
              </div>

              {/* Simulated Files Cabinets */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Document Verification Cabinet</h4>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between items-center p-2.5 rounded-lg border border-slate-200 bg-white shadow-inner">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <FileText size={14} className="text-blue-500 shrink-0" />
                      <span>Bank Statement</span>
                    </div>
                    {selectedApp.status === 'incomplete' ? (
                      <span className="text-[9px] font-bold text-rose-500 lowercase">missing!</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <ShieldCheck size={11} /> Ok
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Briefcase size={14} className="text-indigo-500 shrink-0" />
                      <span>Payslip Slips</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <ShieldCheck size={11} /> Ok
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 rounded-lg border border-slate-200 bg-white col-span-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Lock size={14} className="text-amber-500 shrink-0" />
                      <span>Govt {selectedApp.idType.toUpperCase()} ({selectedApp.idNumber || 'GHA-90123'})</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <ShieldCheck size={11} /> Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Adjust Underwrite loan structures */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Adjust Underwriting Terms</h4>
                
                <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-450 uppercase block">Underwritten Financing Cap</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px] font-bold">{userLocation.symbol}</span>
                      <input 
                        type="number"
                        value={modifiedAmount}
                        onChange={(e) => setModifiedAmount(Number(e.target.value))}
                        className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 font-extrabold border border-slate-250 rounded-xl bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-450 uppercase block">repayment duration months</label>
                    <select
                      value={modifiedDuration}
                      onChange={(e) => setModifiedDuration(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs text-slate-800 font-extrabold border border-slate-250 rounded-xl bg-slate-50 focus:bg-white"
                    >
                      {[3, 6, 12, 18, 24, 30, 36].map(m => (
                        <option key={m} value={m}>{m} Months spread</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Interactive verification log & notes entry */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Admin Auditor Notes & logs</h4>
                <textarea
                  value={adminNotesText}
                  onChange={(e) => setAdminNotesText(e.target.value)}
                  placeholder="Insert review notes, debt verification checklists, early payoff conditions or reasons for program denial..."
                  className="w-full border border-slate-250/70 p-3 rounded-xl text-xs font-medium text-slate-700 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  rows={3}
                />
              </div>

              {/* Simulated Disbursement Payment Escrow Wire */}
              {selectedApp.status === 'approved' && (
                <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider block text-emerald-500 leading-tight">Landlord Disbursement Active Escrow</span>
                    <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-2.5 py-0.5 rounded-full font-black uppercase">Capital wired</span>
                  </div>
                  <p className="text-[10px] text-[#94a3b8] leading-relaxed lowercase">
                    the program capital amount of <strong className="text-emerald-500 font-mono">{userLocation.symbol}{selectedApp.amountRequired.toLocaleString()}</strong> has been wired using secure developer credentials into bank ledger account matching landlord <strong className="text-white">{selectedApp.landlordName}</strong> ({selectedApp.landlordPhone}).
                  </p>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSimulateDefaultRepayment}
                      className="px-2.5 py-1 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-[9px] rounded-lg tracking-wider hover:opacity-90 transition-all uppercase cursor-pointer"
                    >
                      Simulate Repayment collection
                    </button>
                    <button 
                      onClick={() => toast("Audit PDF compiled with landlord bank signing records download started.", "info")}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-350 font-black text-[9px] rounded-lg hover:text-white transition-all uppercase cursor-pointer inline-flex items-center gap-1"
                    >
                      <Download size={10} />
                      Export Escrow Receipt
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Application review actions drawer controls */}
            <div className="p-5 border-t border-slate-100 bg-slate-55/90 sticky bottom-0 z-10 flex gap-2.5 flex-wrap">
              
              <button 
                onClick={() => handleUpdateApplication('approved')}
                disabled={isUpdatingStatus}
                className="flex-1 min-w-[120px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-xl active:scale-97 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={13} className="shrink-0" />
                <span>approve program</span>
              </button>

              <button 
                onClick={() => handleUpdateApplication('under_review')}
                disabled={isUpdatingStatus}
                className="flex-1 min-w-[124px] px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-xl active:scale-97 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Clock size={13} className="shrink-0" />
                <span>place under review</span>
              </button>

              <button 
                onClick={() => handleUpdateApplication('incomplete')}
                disabled={isUpdatingStatus}
                className="flex-1 min-w-[120px] px-3 py-2 bg-slate-600 hover:bg-slate-750 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-xl active:scale-97 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AlertCircle size={13} className="shrink-0" />
                <span>flag incomplete</span>
              </button>

              <button 
                onClick={() => handleUpdateApplication('rejected')}
                disabled={isUpdatingStatus}
                className="flex-1 min-w-[110px] px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-xl active:scale-97 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle size={13} className="shrink-0" />
                <span>deny request</span>
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
