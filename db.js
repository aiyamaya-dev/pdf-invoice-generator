const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'invoices.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  client_name TEXT NOT NULL,
  items_json TEXT NOT NULL,
  subtotal REAL,
  tax_rate REAL DEFAULT 13,
  tax_amount REAL,
  discount REAL DEFAULT 0,
  total REAL NOT NULL,
  currency TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_date DATE
);
`);

module.exports = db;
