import Dexie, { type Table } from 'dexie';

export interface Patient {
  id?: number;
  patientId: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface LabTest {
  id?: number;
  name: string;
  price: number;
}

export interface Record {
  id?: number;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  phone: string;
  tests: { name: string; price: number }[];
  total: number;
  discount: number;
  discountType: 'fixed' | 'percentage';
  finalAmount: number;
  createdAt: string;
}

export interface Settings {
  id?: number;
  key: string;
  value: any;
}

export class PdsLabDatabase extends Dexie {
  patients!: Table<Patient, number>;
  tests!: Table<LabTest, number>;
  records!: Table<Record, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super('PdsLabDatabase');
    this.version(1).stores({
      patients: '++id, patientId, name, phone, createdAt',
      tests: '++id, name',
      records: '++id, patientId, patientName, createdAt',
      settings: '++id, key',
    });
  }
}

export const db = new PdsLabDatabase();

// Seed initial tests if empty
db.on('populate', async () => {
  await db.tests.bulkAdd([
    { name: 'CBC', price: 300 },
    { name: 'Blood Sugar (Fasting)', price: 150 },
    { name: 'Lipid Profile', price: 800 },
    { name: 'Urine R/E', price: 200 },
    { name: 'X-Ray Chest PA View', price: 400 },
    { name: 'ECG', price: 300 },
    { name: 'USG Whole Abdomen', price: 1000 },
  ]);
});
