import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { Users, FileText, DollarSign, Percent, Calendar, TrendingUp, Plus } from 'lucide-react';
import { format, isAfter, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';

type TimeRange = 'today' | '7days' | '30days' | '6months' | '1year' | '5years' | 'all' | 'custom';

interface DashboardProps {
  setActiveTab?: (tab: string) => void;
}

export function Dashboard({ setActiveTab }: DashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [stats, setStats] = useState({
    patients: 0,
    totalTests: 0,
    revenue: 0,
    totalDiscount: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      const allRecords = await db.records.toArray();
      const now = new Date();
      
      let startDate: Date | null = null;
      let endDate: Date | null = now;

      if (timeRange === 'today') startDate = startOfDay(now);
      else if (timeRange === '7days') startDate = subDays(now, 7);
      else if (timeRange === '30days') startDate = subDays(now, 30);
      else if (timeRange === '6months') startDate = subMonths(now, 6);
      else if (timeRange === '1year') startDate = subYears(now, 1);
      else if (timeRange === '5years') startDate = subYears(now, 5);
      else if (timeRange === 'custom') {
        startDate = startOfDay(new Date(customStartDate));
        endDate = endOfDay(new Date(customEndDate));
      }

      const filteredRecords = allRecords.filter(r => {
        const recordDate = new Date(r.createdAt);
        if (timeRange === 'all') return true;
        if (timeRange === 'custom') {
          return recordDate >= startDate! && recordDate <= endDate!;
        }
        return isAfter(recordDate, startDate!);
      });
      
      const patients = filteredRecords.length;
      const totalTests = filteredRecords.reduce((acc, r) => acc + r.tests.length, 0);
      const revenue = filteredRecords.reduce((acc, r) => acc + r.finalAmount, 0);
      const totalDiscount = filteredRecords.reduce((acc, r) => acc + r.discount, 0);

      setStats({ patients, totalTests, revenue, totalDiscount });

      // Generate Chart Data based on timeRange
      let data: any[] = [];
      
      if (timeRange === 'today' || timeRange === '7days' || timeRange === '30days') {
        const days = timeRange === 'today' ? 1 : timeRange === '7days' ? 7 : 30;
        const lastDays = Array.from({ length: days }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return format(d, 'MMM dd');
        }).reverse();

        data = lastDays.map(day => {
          const dayRecords = filteredRecords.filter(r => format(new Date(r.createdAt), 'MMM dd') === day);
          return {
            name: day,
            revenue: dayRecords.reduce((acc, r) => acc + r.finalAmount, 0)
          };
        });
      } else if (timeRange === '6months' || timeRange === '1year') {
        const months = timeRange === '6months' ? 6 : 12;
        const lastMonths = Array.from({ length: months }).map((_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          return format(d, 'MMM yyyy');
        }).reverse();

        data = lastMonths.map(month => {
          const monthRecords = filteredRecords.filter(r => format(new Date(r.createdAt), 'MMM yyyy') === month);
          return {
            name: month,
            revenue: monthRecords.reduce((acc, r) => acc + r.finalAmount, 0)
          };
        });
      } else if (timeRange === 'custom') {
        const daysDiff = Math.abs((endDate!.getTime() - startDate!.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 31) {
          const daysList = [];
          for (let i = 0; i <= daysDiff; i++) {
            const d = new Date(startDate!);
            d.setDate(d.getDate() + i);
            daysList.push(format(d, 'MMM dd'));
          }
          data = daysList.map(day => {
            const dayRecords = filteredRecords.filter(r => format(new Date(r.createdAt), 'MMM dd') === day);
            return { name: day, revenue: dayRecords.reduce((acc, r) => acc + r.finalAmount, 0) };
          });
        } else if (daysDiff <= 365) {
          const uniqueMonths = Array.from(new Set(filteredRecords.map(r => format(new Date(r.createdAt), 'MMM yyyy'))));
          uniqueMonths.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          data = uniqueMonths.map(month => {
            const monthRecords = filteredRecords.filter(r => format(new Date(r.createdAt), 'MMM yyyy') === month);
            return { name: month, revenue: monthRecords.reduce((acc, r) => acc + r.finalAmount, 0) };
          });
        } else {
          const uniqueYears = Array.from(new Set(filteredRecords.map(r => format(new Date(r.createdAt), 'yyyy')))).sort();
          data = uniqueYears.map(year => {
            const yearRecords = filteredRecords.filter(r => format(new Date(r.createdAt), 'yyyy') === year);
            return { name: year, revenue: yearRecords.reduce((acc, r) => acc + r.finalAmount, 0) };
          });
        }
      } else {
        const uniqueYears = Array.from(new Set(filteredRecords.map(r => format(new Date(r.createdAt), 'yyyy')))).sort();
        const yearsToShow = uniqueYears.length > 0 ? uniqueYears : Array.from({ length: 5 }).map((_, i) => String(new Date().getFullYear() - i)).reverse();

        data = yearsToShow.map(year => {
          const yearRecords = filteredRecords.filter(r => format(new Date(r.createdAt), 'yyyy') === year);
          return {
            name: year,
            revenue: yearRecords.reduce((acc, r) => acc + r.finalAmount, 0)
          };
        });
      }

      setChartData(data);
    };

    fetchStats();
  }, [timeRange, customStartDate, customEndDate]);

  const StatCard = ({ title, value, icon: Icon, colorClass, index }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorClass} transition-transform group-hover:scale-110`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="flex items-center text-emerald-500 text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-full">
          <TrendingUp size={10} className="mr-1" />
          +12%
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
      </div>
    </motion.div>
  );

  const timeRangeLabels: Record<TimeRange, string> = {
    today: 'Today',
    '7days': '7 Days',
    '30days': '30 Days',
    '6months': '6 Months',
    '1year': '1 Year',
    '5years': '5 Years',
    all: 'All Time',
    custom: 'Custom'
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Analytics Dashboard</h2>
          <p className="text-slate-500 mt-1 font-medium">Real-time clinical performance metrics.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {setActiveTab && (
            <button
              onClick={() => setActiveTab('add-patient')}
              className="flex items-center justify-center px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-500/20 active:scale-95 sm:mr-2"
            >
              <Plus size={16} className="mr-2" />
              New Patient
            </button>
          )}
          
          {timeRange === 'custom' && (
            <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
              <input 
                type="date" 
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-transparent text-xs focus:outline-none text-slate-700 font-bold"
              />
              <span className="text-slate-300 font-bold text-xs uppercase">to</span>
              <input 
                type="date" 
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-transparent text-xs focus:outline-none text-slate-700 font-bold"
              />
            </div>
          )}
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Calendar size={14} className="text-brand-500" />
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-full sm:w-auto pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer shadow-sm"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last 1 Year</option>
              <option value="5years">Last 5 Years</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          index={0}
          title="Patients" 
          value={stats.patients} 
          icon={Users} 
          colorClass="bg-brand-500 shadow-lg shadow-brand-500/20" 
        />
        <StatCard 
          index={1}
          title="Tests" 
          value={stats.totalTests} 
          icon={FileText} 
          colorClass="bg-indigo-500 shadow-lg shadow-indigo-500/20" 
        />
        <StatCard 
          index={2}
          title="Revenue" 
          value={`৳${stats.revenue.toLocaleString()}`} 
          icon={DollarSign} 
          colorClass="bg-emerald-500 shadow-lg shadow-emerald-500/20" 
        />
        <StatCard 
          index={3}
          title="Discount" 
          value={`৳${stats.totalDiscount.toLocaleString()}`} 
          icon={Percent} 
          colorClass="bg-amber-500 shadow-lg shadow-amber-500/20" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <h3 className="text-sm font-bold text-brand-600 uppercase tracking-wider">Revenue Performance</h3>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">৳{stats.revenue.toLocaleString()}</h2>
              <span className="text-sm font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg flex items-center">
                <TrendingUp size={14} className="mr-1" />
                +12.5%
              </span>
            </div>
            <p className="text-sm text-slate-400 font-medium mt-2">Total revenue for {timeRangeLabels[timeRange]}</p>
          </div>
          <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <button className="px-4 py-2 text-xs font-bold bg-white text-brand-600 rounded-lg shadow-sm">Revenue</button>
            <button className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Volume</button>
          </div>
        </div>
        
        <div className="h-[350px] w-full relative z-10 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                dy={15}
                minTickGap={20}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                tickFormatter={(value) => `৳${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`} 
                dx={-10}
              />
              <Tooltip 
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4', fill: 'transparent' }}
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: '1px solid #f1f5f9', 
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(8px)'
                }}
                itemStyle={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}
                labelStyle={{ color: '#64748b', fontWeight: 700, fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#0ea5e9" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#0284c7', className: 'drop-shadow-md' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

function ChevronDown({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
