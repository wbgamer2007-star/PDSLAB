import React, { useState, useEffect, useRef } from 'react';
import { db, Record } from '@/lib/db';
import { format } from 'date-fns';
import { Search, Printer, Download, Filter, ChevronDown, Upload, Calendar, User, Phone, Activity, MoreVertical, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export function Records() {
  const [records, setRecords] = useState<Record[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayCount, setDisplayCount] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const allRecords = await db.records.orderBy('createdAt').reverse().toArray();
      setRecords(allRecords);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast.error("Failed to load records");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Reset display count when search changes
  useEffect(() => {
    setDisplayCount(50);
  }, [searchTerm]);

  const filteredRecords = records.filter(r => 
    r.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.phone.includes(searchTerm)
  );

  const displayedRecords = filteredRecords.slice(0, displayCount);

  const handleExportManual = () => {
    // Always export ALL filtered records, ignoring the display limit
    const data = filteredRecords.map(r => ({
      Date: format(new Date(r.createdAt), 'yyyy-MM-dd'),
      'Patient ID': r.patientId,
      Name: r.patientName,
      Age: r.age,
      Gender: r.gender,
      Phone: r.phone,
      Tests: r.tests.map(t => t.name).join(', '),
      Total: r.total,
      Discount: r.discount,
      'Final Amount': r.finalAmount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Records');
    XLSX.writeFile(workbook, `PDSLAB_Records_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    toast.success("Records exported successfully");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const patientId = row['Patient ID'];
          if (!patientId) continue;

          const existingRecord = await db.records.where('patientId').equals(patientId).first();
          
          if (existingRecord) {
            // Update existing record with new values from Excel
            await db.records.update(existingRecord.id!, {
              patientName: row['Name'] || existingRecord.patientName,
              age: Number(row['Age']) || existingRecord.age,
              gender: row['Gender'] || existingRecord.gender,
              phone: String(row['Phone'] || existingRecord.phone),
              total: Number(row['Total']) || existingRecord.total,
              discount: Number(row['Discount']) || existingRecord.discount,
              finalAmount: Number(row['Final Amount']) || existingRecord.finalAmount,
            });
            updatedCount++;
          } else {
            // Add NEW record from Excel
            const testsString = row['Tests'] || '';
            const testsArray = testsString.split(',').map((t: string) => ({ 
              name: t.trim(), 
              price: 0 // Default to 0 since Excel export doesn't store individual prices
            })).filter((t: any) => t.name !== '');

            // Try to parse the date, fallback to now
            let createdAt = new Date().toISOString();
            if (row['Date']) {
              const parsedDate = new Date(row['Date']);
              if (!isNaN(parsedDate.getTime())) {
                createdAt = parsedDate.toISOString();
              }
            }

            await db.records.add({
              patientId: String(patientId),
              patientName: String(row['Name'] || 'Unknown'),
              age: Number(row['Age']) || 0,
              gender: (row['Gender'] === 'Male' || row['Gender'] === 'Female' || row['Gender'] === 'Other') ? row['Gender'] : 'Other',
              phone: String(row['Phone'] || ''),
              tests: testsArray,
              total: Number(row['Total']) || 0,
              discount: Number(row['Discount']) || 0,
              discountType: 'fixed',
              finalAmount: Number(row['Final Amount']) || 0,
              createdAt: createdAt
            });
            
            // Also add to patients table to keep it consistent
            await db.patients.add({
              patientId: String(patientId),
              name: String(row['Name'] || 'Unknown'),
              age: Number(row['Age']) || 0,
              gender: (row['Gender'] === 'Male' || row['Gender'] === 'Female' || row['Gender'] === 'Other') ? row['Gender'] : 'Other',
              phone: String(row['Phone'] || ''),
              address: '',
              createdAt: createdAt
            });

            addedCount++;
          }
        }
        
        toast.success(`Successfully added ${addedCount} new records and updated ${updatedCount} existing records!`);
        fetchRecords(); // Refresh the table
      } catch (error) {
        console.error("Error importing Excel:", error);
        toast.error("Failed to import Excel file. Please ensure it's the correct format.");
      }
    };
    reader.readAsBinaryString(file);
    
    // Reset file input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Patient Records</h2>
          <p className="text-slate-500 mt-1 font-medium">View and manage all past patient entries.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImportExcel}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"
          >
            <Upload size={16} className="mr-2 text-brand-600" />
            Sync Excel
          </button>
          <button 
            onClick={handleExportManual}
            className="flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <Download size={16} className="mr-2" />
            Export ({filteredRecords.length})
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by ID, Name, or Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
          </div>
          <button className="flex items-center justify-center px-6 py-3.5 bg-white border border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-bold text-xs uppercase tracking-widest active:scale-95">
            <Filter size={18} className="mr-2 text-brand-600" />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-[0.15em] font-black border-b border-slate-100">
                <th className="px-8 py-5">Date & ID</th>
                <th className="px-8 py-5">Patient Info</th>
                <th className="px-8 py-5">Investigations</th>
                <th className="px-8 py-5 text-right">Amount</th>
                <th className="px-8 py-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td colSpan={5} className="px-8 py-6">
                        <div className="h-12 bg-slate-50 rounded-2xl w-full" />
                      </td>
                    </tr>
                  ))
                ) : displayedRecords.length === 0 ? (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white"
                  >
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                          <Search size={32} className="text-slate-200" />
                        </div>
                        <p className="text-xl font-bold text-slate-900 tracking-tight">No records found</p>
                        <p className="text-slate-500 font-medium mt-1">Try adjusting your search terms or filters.</p>
                      </div>
                    </td>
                  </motion.tr>
                ) : (
                  displayedRecords.map((record, index) => (
                    <motion.tr 
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-slate-50/50 transition-all group cursor-default"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="bg-brand-50 p-2 rounded-xl">
                            <Calendar size={18} className="text-brand-600" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 tracking-tight">{format(new Date(record.createdAt), 'MMM dd, yyyy')}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{format(new Date(record.createdAt), 'hh:mm a')}</div>
                            <div className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-brand-50 text-brand-600 uppercase tracking-widest mt-2 border border-brand-100">
                              {record.patientId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="bg-indigo-50 p-2 rounded-xl">
                            <User size={18} className="text-indigo-600" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 tracking-tight">{record.patientName}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{record.age}Y • {record.gender}</div>
                            <div className="flex items-center text-[10px] font-bold text-slate-500 mt-1">
                              <Phone size={10} className="mr-1" />
                              {record.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-2 max-w-xs">
                          {record.tests.map((t, i) => (
                            <span key={i} className="inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/50">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-black text-slate-900 text-lg tracking-tight">৳{record.finalAmount.toLocaleString()}</div>
                        {record.discount > 0 && (
                          <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">
                            Saved ৳{record.discount.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => printReceipt(record)}
                            className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all active:scale-90"
                            title="Print Receipt"
                          >
                            <Printer size={18} />
                          </button>
                          <button 
                            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all active:scale-90"
                            title="View Details"
                          >
                            <FileText size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredRecords.length > displayCount && (
          <div className="p-8 border-t border-slate-50 flex justify-center bg-slate-50/30">
            <button
              onClick={() => setDisplayCount(prev => prev + 50)}
              className="flex items-center px-8 py-3.5 bg-white border border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 font-bold text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"
            >
              <ChevronDown size={18} className="mr-2 text-brand-600" />
              Load More ({filteredRecords.length - displayCount})
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
