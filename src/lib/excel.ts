import * as XLSX from 'xlsx';
import { db, Record } from './db';
import { format } from 'date-fns';
import { toast } from 'sonner';

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });
    return handle;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('User cancelled directory picker');
    } else if (err.message?.includes('Cross origin sub frames')) {
      toast.error('Browser security prevents folder selection in preview. Please open the app in a new tab.');
    } else {
      console.error('Error getting directory handle:', err);
      toast.error('Failed to select folder. Please try again.');
    }
    return null;
  }
}

export async function verifyPermission(fileHandle: FileSystemHandle, readWrite: boolean) {
  const options = { mode: readWrite ? 'readwrite' : 'read' } as any;
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

export async function syncToExcel(directoryHandle: FileSystemDirectoryHandle) {
  try {
    const hasPermission = await verifyPermission(directoryHandle, true);
    if (!hasPermission) {
      console.error('No permission to write to directory');
      toast.error('Please grant permission to write to the sync folder.');
      return;
    }

    const records = await db.records.toArray();
    
    // Format data for Excel
    const data = records.map(r => ({
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

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    // Write to file
    const fileHandle = await directoryHandle.getFileHandle('PDSLAB_Records.xlsx', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(excelBuffer);
    await writable.close();
    console.log('Successfully synced to Excel');
  } catch (error) {
    console.error('Error syncing to Excel:', error);
    toast.error('Error syncing to Excel. Please check the console.');
  }
}
