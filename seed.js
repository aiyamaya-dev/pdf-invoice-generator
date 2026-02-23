const db = require('./db');

// Clear existing data
db.exec('DELETE FROM invoices; DELETE FROM clients;');

// Seed clients
const insertClient = db.prepare('INSERT INTO clients (name, email, address, phone) VALUES (?, ?, ?, ?)');
const clients = [
  ['Maple Tech Inc.', 'billing@mapletech.ca', '100 Bay Street, Suite 400, Toronto, ON M5J 2T3', '(416) 555-0101'],
  ['Great Lakes Consulting', 'invoices@greatlakes.ca', '250 University Ave, Waterloo, ON N2L 3G1', '(519) 555-0202'],
  ['Pacific Digital Agency', 'accounts@pacificdigital.ca', '800 Robson Street, Vancouver, BC V6Z 3B7', '(604) 555-0303'],
  ['Aurora Health Systems', 'finance@aurorahealth.ca', '55 Metcalfe Street, Ottawa, ON K1P 6L5', '(613) 555-0404'],
  ['Summit Financial Group', 'ap@summitfinancial.ca', '150 8th Ave SW, Calgary, AB T2P 3S2', '(403) 555-0505'],
];
clients.forEach(c => insertClient.run(...c));

// Seed invoices
const insertInvoice = db.prepare(`INSERT INTO invoices 
  (invoice_number, client_id, client_name, items_json, subtotal, tax_rate, tax_amount, discount, total, currency, status, due_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const invoiceData = [
  { num: 'INV-2026-001', clientIdx: 0, items: [{desc:'Web Application Development',qty:1,rate:8500}], discount:0, status:'paid', due:'2026-01-15' },
  { num: 'INV-2026-002', clientIdx: 1, items: [{desc:'IT Strategy Consulting',qty:40,rate:150},{desc:'Documentation',qty:1,rate:500}], discount:200, status:'paid', due:'2026-01-20' },
  { num: 'INV-2026-003', clientIdx: 2, items: [{desc:'UI/UX Design Package',qty:1,rate:3200},{desc:'Brand Guidelines',qty:1,rate:800}], discount:0, status:'sent', due:'2026-02-28' },
  { num: 'INV-2026-004', clientIdx: 3, items: [{desc:'EMR Integration',qty:1,rate:12000},{desc:'Training Sessions',qty:3,rate:500}], discount:500, status:'paid', due:'2026-01-30' },
  { num: 'INV-2026-005', clientIdx: 4, items: [{desc:'Security Audit',qty:1,rate:4500}], discount:0, status:'overdue', due:'2026-01-10' },
  { num: 'INV-2026-006', clientIdx: 0, items: [{desc:'Monthly Maintenance',qty:1,rate:850}], discount:0, status:'sent', due:'2026-02-25' },
  { num: 'INV-2026-007', clientIdx: 1, items: [{desc:'Cloud Migration Phase 1',qty:1,rate:7500},{desc:'AWS Setup',qty:1,rate:1200}], discount:200, status:'paid', due:'2026-02-01' },
  { num: 'INV-2026-008', clientIdx: 2, items: [{desc:'Mobile App Prototype',qty:1,rate:5500}], discount:0, status:'overdue', due:'2026-01-25' },
  { num: 'INV-2026-009', clientIdx: 3, items: [{desc:'HIPAA Compliance Review',qty:1,rate:3800}], discount:0, status:'sent', due:'2026-03-01' },
  { num: 'INV-2026-010', clientIdx: 4, items: [{desc:'API Development',qty:1,rate:6200},{desc:'Documentation',qty:1,rate:800}], discount:0, status:'draft', due:'2026-03-15' },
];

invoiceData.forEach(inv => {
  const clientName = clients[inv.clientIdx][0];
  const clientId = inv.clientIdx + 1;
  const subtotal = inv.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
  const taxRate = 13;
  const taxAmount = Math.round((subtotal - inv.discount) * taxRate) / 100;
  const total = subtotal - inv.discount + taxAmount;
  insertInvoice.run(inv.num, clientId, clientName, JSON.stringify(inv.items), subtotal, taxRate, taxAmount, inv.discount, total, 'CAD', inv.status, inv.due);
});

console.log('✅ Seeded 5 clients and 10 invoices');
const stats = db.prepare('SELECT status, COUNT(*) as count FROM invoices GROUP BY status').all();
console.log('Invoice status distribution:', stats);
