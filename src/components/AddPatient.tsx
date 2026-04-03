import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, LabTest, Record } from '@/lib/db';
import { syncToExcel } from '@/lib/excel';
import { Plus, Trash2, Save, Search, AlertCircle, Receipt, User, Phone, MapPin, Calendar, CreditCard, CheckCircle2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().min(0, 'Age must be positive'),
  gender: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().min(10, 'Valid phone required'),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function AddPatient() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientId, setPatientId] = useState('');
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isIframe = window !== window.parent;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gender: 'Male',
      age: 0,
      phone: '',
      name: '',
      address: '',
    }
  });

  useEffect(() => {
    const loadData = async () => {
      const allTests = await db.tests.toArray();
      setTests(allTests);

      // Generate next Patient ID
      const records = await db.records.toArray();
      const nextId = records.length + 1;
      setPatientId(`P${nextId.toString().padStart(3, '0')}`);

      // Load directory handle if exists
      const handleSetting = await db.settings.where('key').equals('directoryHandle').first();
      if (handleSetting) {
        setDirectoryHandle(handleSetting.value);
      }
    };
    loadData();
  }, []);

  const total = selectedTests.reduce((acc, test) => acc + test.price, 0);
  const discountAmount = discountType === 'fixed' ? discountValue : (total * discountValue) / 100;
  const finalAmount = total - discountAmount;

  const handleAddTest = (test: LabTest) => {
    if (!selectedTests.find(t => t.id === test.id)) {
      setSelectedTests([...selectedTests, test]);
    }
    setSearchTerm('');
  };

  const handleRemoveTest = (id: number) => {
    setSelectedTests(selectedTests.filter(t => t.id !== id));
  };

  const onSubmit = async (data: FormData) => {
    if (selectedTests.length === 0) {
      toast.error('Please select at least one test.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save Patient
      await db.patients.add({
        patientId,
        ...data,
        address: data.address || '',
        createdAt: new Date().toISOString(),
      });

      // Save Record
      const newRecord: Record = {
        patientId,
        patientName: data.name,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        tests: selectedTests.map(t => ({ name: t.name, price: t.price })),
        total,
        discount: discountAmount,
        discountType,
        finalAmount,
        createdAt: new Date().toISOString(),
      };

      await db.records.add(newRecord);

      // Sync to Excel
      if (directoryHandle) {
        if (isIframe) {
          toast.warning('Record saved locally. Excel sync is blocked in preview mode. Please open in a new tab.');
        } else {
          await syncToExcel(directoryHandle);
          toast.success('Record saved and synced to Excel!');
        }
      } else {
        toast.warning('Record saved locally. Please set up Excel sync in Settings to enable auto-sync.');
      }

      // Print Receipt
      printReceipt(newRecord);

      // Reset Form
      reset();
      setSelectedTests([]);
      setDiscountValue(0);
      
      // Update Patient ID for next
      const records = await db.records.toArray();
      setPatientId(`P${(records.length + 1).toString().padStart(3, '0')}`);

    } catch (error) {
      console.error('Error saving record:', error);
      toast.error('Failed to save record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const printReceipt = (record: Record) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Receipt - ${record.patientId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; max-width: 500px; margin: 0 auto; color: #1e293b; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; }
            .logo { font-weight: 800; font-size: 24px; color: #0ea5e9; letter-spacing: -0.025em; margin-bottom: 4px; }
            .subtitle { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px; font-size: 14px; }
            .info-item { display: flex; flex-direction: column; }
            .label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
            .value { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
            td { padding: 12px 0; font-size: 14px; font-weight: 500; border-bottom: 1px solid #f8fafc; }
            .text-right { text-align: right; }
            .totals { margin-left: auto; width: 200px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .grand-total { border-top: 2px solid #f1f5f9; margin-top: 8px; padding-top: 12px; font-weight: 800; font-size: 18px; color: #0ea5e9; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #94a3b8; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">PDSLAB</div>
            <div class="subtitle">Clinical Pathology Laboratory</div>
            <p style="font-size: 12px; margin-top: 8px;">Date: ${new Date(record.createdAt).toLocaleString()}</p>
          </div>
          
          <div class="info-grid">
            <div class="info-item"><span class="label">Patient ID</span><span class="value">${record.patientId}</span></div>
            <div class="info-item"><span class="label">Patient Name</span><span class="value">${record.patientName}</span></div>
            <div class="info-item"><span class="label">Age / Gender</span><span class="value">${record.age}Y / ${record.gender}</span></div>
            <div class="info-item"><span class="label">Phone</span><span class="value">${record.phone}</span></div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Investigation</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${record.tests.map(t => `
                <tr>
                  <td>${t.name}</td>
                  <td class="text-right">৳${t.price.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="total-row"><span>Subtotal</span><span>৳${record.total.toLocaleString()}</span></div>
            <div class="total-row" style="color: #10b981;"><span>Discount</span><span>- ৳${record.discount.toLocaleString()}</span></div>
            <div class="total-row grand-total"><span>Total</span><span>৳${record.finalAmount.toLocaleString()}</span></div>
          </div>
          
          <div class="footer">
            <p>Thank you for choosing PDSLAB</p>
            <p>This is a computer generated receipt.</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredTests = tests.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">New Patient Entry</h2>
          <p className="text-slate-500 mt-1 font-medium">Register patient and select investigations.</p>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm px-6 py-3 rounded-[20px] flex items-center space-x-3">
          <div className="bg-brand-50 p-2 rounded-lg">
            <Activity size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Patient ID</p>
            <p className="font-mono font-bold text-slate-900 text-xl leading-none">{patientId}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Patient Info & Tests */}
        <div className="lg:col-span-8 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100"
          >
            <div className="flex items-center space-x-3 mb-8">
              <div className="bg-brand-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                <User size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Patient Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={16} className="text-slate-400" />
                  </div>
                  <input 
                    {...register('name')} 
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                    placeholder="e.g. Rahim Uddin"
                  />
                </div>
                {errors.name && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider ml-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Age</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Calendar size={16} className="text-slate-400" />
                    </div>
                    <input 
                      type="number"
                      {...register('age', { valueAsNumber: true })} 
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                    />
                  </div>
                  {errors.age && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider ml-1">{errors.age.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Gender</label>
                  <select 
                    {...register('gender')}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium appearance-none cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone size={16} className="text-slate-400" />
                  </div>
                  <input 
                    {...register('phone')} 
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                {errors.phone && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider ml-1">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MapPin size={16} className="text-slate-400" />
                  </div>
                  <input 
                    {...register('address')} 
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Test Selection */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100"
          >
            <div className="flex items-center space-x-3 mb-8">
              <div className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Activity size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Select Investigations</h3>
            </div>
            
            <div className="relative mb-8">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search for tests (e.g. CBC, Blood Sugar)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium"
              />
              
              <AnimatePresence>
                {searchTerm && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute z-10 w-full mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-72 overflow-y-auto no-scrollbar"
                  >
                    {filteredTests.length > 0 ? (
                      filteredTests.map(test => (
                        <button
                          key={test.id}
                          type="button"
                          onClick={() => handleAddTest(test)}
                          className="w-full text-left px-6 py-4 hover:bg-slate-50 flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors group"
                        >
                          <div>
                            <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{test.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Investigation</p>
                          </div>
                          <span className="text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-xl text-sm">৳{test.price.toLocaleString()}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Search size={20} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold text-sm">No investigations found</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-3">
              {selectedTests.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/30">
                  <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <Plus size={24} className="text-slate-300" />
                  </div>
                  <p className="font-bold text-slate-500">No investigations selected</p>
                  <p className="text-xs font-medium mt-1">Search and add tests to begin billing.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {selectedTests.map((test) => (
                      <motion.div 
                        key={test.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex justify-between items-center p-5 bg-white rounded-2xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all hover:shadow-md"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{test.name}</p>
                          <p className="text-indigo-600 font-bold text-xs mt-0.5">৳{test.price.toLocaleString()}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTest(test.id!)}
                          className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all"
                          aria-label="Remove test"
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Billing */}
        <div className="lg:col-span-4">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 sticky top-8 overflow-hidden"
          >
            <div className="p-8 border-b border-slate-800 bg-slate-800/30">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white tracking-tight flex items-center">
                  <Receipt className="mr-3 text-brand-400" size={24} />
                  Billing
                </h3>
                <div className="bg-brand-500/10 text-brand-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {selectedTests.length} Items
                </div>
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Subtotal</span>
                  <span className="font-bold text-white text-lg">৳{total.toLocaleString()}</span>
                </div>
                
                <div className="pt-6 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discount</label>
                    <div className="flex bg-slate-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={cn(
                          "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                          discountType === 'fixed' ? "bg-brand-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                        )}
                      >
                        FIXED
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percentage')}
                        className={cn(
                          "px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all",
                          discountType === 'percentage' ? "bg-brand-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                        )}
                      >
                        PERCENT
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <CreditCard size={16} className="text-slate-500" />
                    </div>
                    <input
                      type="number"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-full pl-11 pr-12 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-white font-bold placeholder:text-slate-600"
                      placeholder="0"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-slate-500 font-bold text-sm">{discountType === 'fixed' ? '৳' : '%'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Savings</span>
                  <span className="font-bold text-emerald-500">- ৳{discountAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-800">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Payable</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-4xl font-black text-white tracking-tighter">৳{finalAmount.toLocaleString()}</span>
                    <span className="text-brand-400 font-bold text-xs uppercase tracking-widest">BDT</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full group relative flex items-center justify-center py-5 px-6 bg-brand-600 hover:bg-brand-500 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-brand-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={18} className="mr-3" />
                      Complete & Print
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setSelectedTests([]);
                    setDiscountValue(0);
                  }}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center py-4 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-[1.5rem] font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Trash2 size={16} className="mr-2" />
                  Clear Form
                </button>
                
                <div className="mt-6 space-y-3">
                  {!directoryHandle && (
                    <div className="flex items-center justify-center space-x-2 text-amber-400/80">
                      <AlertCircle size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Excel sync not configured</span>
                    </div>
                  )}
                  {directoryHandle && isIframe && (
                    <div className="flex items-center justify-center space-x-2 text-amber-400/80">
                      <AlertCircle size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">New tab required for sync</span>
                    </div>
                  )}
                  {directoryHandle && !isIframe && (
                    <div className="flex items-center justify-center space-x-2 text-emerald-400/80">
                      <CheckCircle2 size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Auto-sync enabled</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </form>
    </div>
  );
}
