const express = require('express');
const path = require('path');
const db = require('./db');
const { generateInvoicePDF } = require('./invoice');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Invoices ---
app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
  invoices.forEach(inv => { inv.items = JSON.parse(inv.items_json); });
  res.json(invoices);
});

app.get('/api/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  inv.items = JSON.parse(inv.items_json);
  res.json(inv);
});

app.post('/api/invoices', (req, res) => {
  const d = req.body;
  if (!d.items || !d.items.length) return res.status(400).json({ error: 'Items required' });
  
  const subtotal = d.items.reduce((s, i) => s + (i.qty || 1) * (i.rate || 0), 0);
  const taxRate = d.tax_rate ?? 13;
  const discount = d.discount || 0;
  const taxAmount = Math.round((subtotal - discount) * taxRate) / 100;
  const total = subtotal - discount + taxAmount;
  
  // Generate invoice number
  const last = db.prepare("SELECT invoice_number FROM invoices WHERE invoice_number LIKE 'INV-2026-%' ORDER BY invoice_number DESC LIMIT 1").get();
  let nextNum = 1;
  if (last) nextNum = parseInt(last.invoice_number.split('-')[2]) + 1;
  const invoice_number = d.invoice_number || `INV-2026-${String(nextNum).padStart(3, '0')}`;
  
  try {
    const result = db.prepare(`INSERT INTO invoices (invoice_number, client_id, client_name, items_json, subtotal, tax_rate, tax_amount, discount, total, currency, status, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      invoice_number, d.client_id || null, d.client_name || 'Unknown', JSON.stringify(d.items),
      subtotal, taxRate, taxAmount, discount, total, d.currency || 'CAD', d.status || 'draft', d.due_date || null
    );
    res.json({ id: result.lastInsertRowid, invoice_number });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/invoices/:id', (req, res) => {
  const d = req.body;
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  // If items provided, recalculate
  let subtotal = existing.subtotal, taxRate = existing.tax_rate, taxAmount = existing.tax_amount, discount = existing.discount, total = existing.total;
  let items_json = existing.items_json;
  
  if (d.items) {
    items_json = JSON.stringify(d.items);
    subtotal = d.items.reduce((s, i) => s + (i.qty || 1) * (i.rate || 0), 0);
    taxRate = d.tax_rate ?? existing.tax_rate;
    discount = d.discount ?? existing.discount;
    taxAmount = Math.round((subtotal - discount) * taxRate) / 100;
    total = subtotal - discount + taxAmount;
  }

  db.prepare(`UPDATE invoices SET client_id=?, client_name=?, items_json=?, subtotal=?, tax_rate=?, tax_amount=?, discount=?, total=?, currency=?, status=?, due_date=? WHERE id=?`).run(
    d.client_id ?? existing.client_id, d.client_name ?? existing.client_name, items_json,
    subtotal, taxRate, taxAmount, discount, total,
    d.currency ?? existing.currency, d.status ?? existing.status, d.due_date ?? existing.due_date, req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/invoices/:id', (req, res) => {
  const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

app.get('/api/invoices/:id/pdf', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  inv.items = JSON.parse(inv.items_json);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${inv.invoice_number}.pdf`);
  const doc = generateInvoicePDF({
    invoiceNumber: inv.invoice_number,
    company: 'NovaTech Solutions',
    companyAddress: '200 King Street West, Toronto, ON M5H 3T4',
    client: inv.client_name,
    items: inv.items,
    tax: inv.tax_rate,
    discount: inv.discount,
    currency: inv.currency,
    dueDate: inv.due_date,
    status: inv.status,
  });
  doc.pipe(res);
  doc.end();
});

// --- Clients ---
app.get('/api/clients', (req, res) => {
  res.json(db.prepare('SELECT * FROM clients ORDER BY name').all());
});

app.post('/api/clients', (req, res) => {
  const d = req.body;
  if (!d.name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare('INSERT INTO clients (name, email, address, phone) VALUES (?, ?, ?, ?)').run(d.name, d.email || null, d.address || null, d.phone || null);
  res.json({ id: result.lastInsertRowid });
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
  const paid = db.prepare("SELECT COALESCE(SUM(total),0) as amount FROM invoices WHERE status='paid'").get();
  const pending = db.prepare("SELECT COALESCE(SUM(total),0) as amount FROM invoices WHERE status='sent'").get();
  const overdue = db.prepare("SELECT COALESCE(SUM(total),0) as amount FROM invoices WHERE status='overdue'").get();
  res.json({ total_revenue: paid.amount, pending: pending.amount, overdue: overdue.amount });
});

// Legacy endpoint
app.post('/api/invoice', (req, res) => {
  const data = req.body;
  if (!data.items || !data.items.length) return res.status(400).json({ error: 'Items required' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${Date.now()}.pdf`);
  const doc = generateInvoicePDF(data);
  doc.pipe(res);
  doc.end();
});

const PORT = process.env.PORT || 3002;
const server = app.listen(PORT, () => console.log(`📄 Invoice Generator running on http://localhost:${PORT}`));
module.exports = { app, server };
