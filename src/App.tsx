/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { AddPatient } from '@/components/AddPatient';
import { Records } from '@/components/Records';
import { Settings } from '@/components/Settings';
import { Toaster } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard key="dashboard" setActiveTab={setActiveTab} />;
      case 'add-patient':
        return <AddPatient key="add-patient" />;
      case 'records':
        return <Records key="records" />;
      case 'settings':
        return <Settings key="settings" />;
      default:
        return <Dashboard key="default" />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden text-slate-900">
      <Toaster position="top-right" richColors theme="light" />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-20 md:pt-8 w-full relative">
        <div className="max-w-7xl mx-auto h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

