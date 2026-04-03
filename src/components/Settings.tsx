import React, { useState, useEffect, useRef } from 'react';
import { db, LabTest } from '@/lib/db';
import { getDirectoryHandle, verifyPermission } from '@/lib/excel';
import { Folder, Save, Plus, Trash2, AlertCircle, CheckCircle2, ExternalLink, Download, Upload, Settings as SettingsIcon, Activity, Database, ShieldCheck, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export function Settings() {
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [newTestName, setNewTestName] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const isIframe = window !== window.parent;

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const handleSetting = await db.settings.where('key').equals('directoryHandle').first();
      if (handleSetting && handleSetting.value) {
        setDirectoryName(handleSetting.value.name);
      }

      const allTests = await db.tests.toArray();
      setTests(allTests);

      const count = await db.records.count();
      setRecordCount(count);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSelectFolder = async () => {
    if (isIframe) {
      toast.error("Folder sync requires opening the app in a new tab.");
      return;
    }
    
    try {
      const handle = await getDirectoryHandle();
      if (handle) {
        const hasPermission = await verifyPermission(handle, true);
        if (hasPermission) {
          await db.settings.put({ key: 'directoryHandle', value: handle });
          setDirectoryName(handle.name);
          setSyncStatus('success');
          toast.success("Excel sync folder connected!");
          setTimeout(() => setSyncStatus('idle'), 3000);
        } else {
          setSyncStatus('error');
          toast.error("Permission denied for folder access");
        }
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
      toast.error("Failed to connect folder");
    }
  };

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestName || !newTestPrice) return;

    const test: LabTest = {
      name: newTestName,
      price: Number(newTestPrice),
    };

    try {
      await db.tests.add(test);
      setTests([...tests, test]);
      setNewTestName('');
      setNewTestPrice('');
      toast.success('Investigation added successfully');
    } catch (error) {
      console.error("Error adding test:", error);
      toast.error("Failed to add investigation");
    }
  };

  const handleDeleteTest = async (id: number) => {
    try {
      await db.tests.delete(id);
      setTests(tests.filter(t => t.id !== id));
      toast.success('Investigation deleted successfully');
    } catch (error) {
      console.error("Error deleting test:", error);
      toast.error("Failed to delete investigation");
    }
  };

  const handleExportTests = () => {
    const data = tests.map(t => ({
      'Test ID': t.id || '',
      'Test Name': t.name,
      'Price': t.price
    }));

    // If there are no tests, provide a dummy row so the user knows the format
    if (data.length === 0) {
      data.push({
        'Test ID': '',
        'Test Name': 'Example Test (Replace Me)',
        'Price': 500
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lab Tests');
    XLSX.writeFile(workbook, 'PDSLAB_Lab_Tests_Format.xlsx');
    toast.success("Template exported successfully");
  };

  const handleImportTests = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let updatedCount = 0;
        let addedCount = 0;

        for (const row of data as any[]) {
          const testName = row['Test Name'];
          const price = Number(row['Price']);
          
          if (!testName || isNaN(price)) continue;
          if (testName === 'Example Test (Replace Me)') continue;

          // Check if test exists by ID or exact Name
          let existingTest = null;
          if (row['Test ID']) {
            existingTest = await db.tests.get(Number(row['Test ID']));
          }
          if (!existingTest) {
            existingTest = await db.tests.where('name').equals(testName).first();
          }
          
          if (existingTest) {
            await db.tests.update(existingTest.id!, {
              name: testName,
              price: price
            });
            updatedCount++;
          } else {
            await db.tests.add({
              name: testName,
              price: price
            });
            addedCount++;
          }
        }
        
        toast.success(`Successfully added ${addedCount} and updated ${updatedCount} investigations!`);
        loadSettings(); // Refresh the table
      } catch (error) {
        console.error("Error importing Excel:", error);
        toast.error("Failed to import Excel file. Please ensure it's the correct format.");
      }
    };
    reader.readAsBinaryString(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h2>
          <p className="text-slate-500 mt-1 font-medium">Manage application preferences and clinical data.</p>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm px-6 py-3 rounded-[20px] flex items-center space-x-3">
          <div className="bg-brand-50 p-2 rounded-lg">
            <SettingsIcon size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">System Status</p>
            <p className="font-bold text-emerald-500 text-sm leading-none flex items-center">
              <CheckCircle2 size={12} className="mr-1" /> Operational
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Main Settings */}
        <div className="lg:col-span-8 space-y-8">
          {/* Excel Sync Settings */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <div className="flex items-center space-x-4">
                <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
                  <Folder size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Excel Auto-Sync</h3>
                  <p className="text-sm text-slate-500 font-medium">Connect a local folder for automatic backups.</p>
                </div>
              </div>
            </div>
            
            <div className="p-8">
              {isIframe && (
                <div className="mb-8 bg-amber-50 border border-amber-100 rounded-[2rem] p-6 flex items-start space-x-4">
                  <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider">Preview Mode Limitation</h4>
                    <p className="text-sm text-amber-700 mt-1 font-medium leading-relaxed">
                      Browsers block folder selection inside iframes for security. To setup Excel sync, you must open this app in a new tab.
                    </p>
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="mt-4 inline-flex items-center px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-amber-600/20 active:scale-95"
                    >
                      <ExternalLink size={14} className="mr-2" />
                      Open in New Tab
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex items-center space-x-4">
                  {directoryName ? (
                    <>
                      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                        <Folder className="text-brand-600" size={28} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-lg tracking-tight">{directoryName}</p>
                        <div className="flex items-center mt-1">
                          <span className="flex items-center text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            <CheckCircle2 size={10} className="mr-1" /> Connected & Active
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-slate-100 p-3 rounded-2xl text-slate-300">
                        <Folder size={28} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 text-lg tracking-tight">No folder selected</p>
                        <p className="text-xs font-medium text-slate-400 mt-1">Records will only be saved locally.</p>
                      </div>
                    </>
                  )}
                </div>
                
                <button
                  onClick={handleSelectFolder}
                  disabled={isIframe}
                  className={cn(
                    "px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95",
                    isIframe 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : directoryName 
                        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm' 
                        : 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/20'
                  )}
                >
                  {directoryName ? 'Change Folder' : 'Connect Folder'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Lab Tests Management */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div className="flex items-center space-x-4">
                <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Investigation List</h3>
                  <p className="text-sm text-slate-500 font-medium">Manage available tests and pricing.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImportTests}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                >
                  <Upload size={14} className="mr-2 text-brand-600" />
                  Import
                </button>
                <button 
                  onClick={handleExportTests}
                  className="flex items-center px-5 py-2.5 bg-brand-50 text-brand-600 border border-brand-100 hover:bg-brand-100 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                >
                  <Download size={14} className="mr-2" />
                  Template
                </button>
              </div>
            </div>
            
            <div className="p-8">
              <form onSubmit={handleAddTest} className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-10">
                <div className="sm:col-span-7">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Investigation Name</label>
                  <input
                    type="text"
                    value={newTestName}
                    onChange={(e) => setNewTestName(e.target.value)}
                    placeholder="e.g. Complete Blood Count (CBC)"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Price (৳)</label>
                  <input
                    type="number"
                    value={newTestPrice}
                    onChange={(e) => setNewTestPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 font-bold"
                    required
                    min="0"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full h-[52px] bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all flex items-center justify-center shadow-lg active:scale-95"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </form>

              <div className="border border-slate-100 rounded-[2rem] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-[0.15em] font-black border-b border-slate-100">
                      <th className="px-8 py-5">Investigation</th>
                      <th className="px-8 py-5 text-right">Price</th>
                      <th className="px-8 py-5 text-center w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tests.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-8 py-16 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                              <Activity size={24} className="text-slate-200" />
                            </div>
                            <p className="text-slate-500 font-bold text-sm">No investigations configured</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      tests.map((test) => (
                        <tr key={test.id} className="hover:bg-slate-50/50 transition-all group">
                          <td className="px-8 py-5 font-bold text-slate-900 tracking-tight">{test.name}</td>
                          <td className="px-8 py-5 font-black text-brand-600 text-right">৳{test.price.toLocaleString()}</td>
                          <td className="px-8 py-5 text-center">
                            <button
                              onClick={() => handleDeleteTest(test.id!)}
                              className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"
                              title="Delete Test"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: System Info */}
        <div className="lg:col-span-4 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 text-white"
          >
            <div className="flex items-center space-x-3 mb-8">
              <div className="bg-brand-500/10 p-2 rounded-xl">
                <Database size={20} className="text-brand-400" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Database Info</h3>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Records</span>
                <span className="font-black text-xl text-white">{recordCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Tests</span>
                <span className="font-black text-xl text-white">{tests.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Storage Type</span>
                <span className="font-bold text-brand-400 text-sm">IndexedDB (Local)</span>
              </div>
              
              <div className="pt-6 border-t border-slate-800">
                <div className="flex items-center space-x-3 text-emerald-400 mb-4">
                  <ShieldCheck size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Security Verified</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Your data is stored securely on your device. Excel sync provides an additional layer of backup and portability.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100"
          >
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group">
                <div className="flex items-center space-x-3">
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    <Download size={16} className="text-brand-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Backup Database</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-600 transition-all" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group">
                <div className="flex items-center space-x-3">
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    <Trash2 size={16} className="text-red-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Clear Cache</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-red-500 transition-all" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
