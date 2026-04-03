import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  FileText, 
  Settings, 
  Menu,
  X,
  Activity,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add-patient', label: 'Add Patient', icon: UserPlus },
    { id: 'records', label: 'Records', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="bg-brand-600 p-1.5 rounded-lg">
            <Activity className="text-white" size={20} />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">PDSLAB</span>
        </div>
        <button 
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center h-20 px-8">
          <div className="bg-brand-600 p-2 rounded-xl mr-3 shadow-lg shadow-brand-500/20">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">PDSLAB</h1>
            <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-widest mt-1">Clinical System</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "group flex items-center w-full px-4 py-3.5 text-sm font-medium rounded-2xl transition-all duration-200 relative overflow-hidden",
                  isActive 
                    ? "bg-brand-50 text-brand-600" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-nav"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600 rounded-r-full"
                  />
                )}
                <Icon className={cn("mr-3 transition-colors", isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600")} size={20} />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight size={14} className="text-brand-600" />}
              </button>
            );
          })}
        </nav>

        <div className="p-6 mx-4 mb-6 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-sm font-bold text-brand-600">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Admin User</p>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Receptionist</p>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-30 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
