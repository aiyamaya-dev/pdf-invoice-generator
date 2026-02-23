const http = require('http');
const { app, server } = require('./server');

const BASE = 'http://localhost:3002';
let passed = 0, failed = 0, total = 0;

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        resolve({ status: res.statusCode, body: ct.includes('json') ? JSON.parse(buf) : buf, headers: res.headers });
      });
    }).on('error', reject);
  });
}

function req(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const r = http.request(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

function del(path) {
  return new Promise((resolve, reject) => {
    const r = http.request(BASE + path, { method: 'DELETE' }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    r.on('error', reject);
    r.end();
  });
}

function test(name, fn) {
  return fn().then(() => { passed++; total++; console.log(`  ✅ ${name}`); })
    .catch(e => { failed++; total++; console.log(`  ❌ ${name}: ${e.message}`); });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function run() {
  console.log('\n🧪 Running Invoice API Tests...\n');

  // Seed data tests
  console.log('📦 Seed Data Tests:');
  await test('GET /api/invoices returns 10 invoices', async () => {
    const r = await get('/api/invoices');
    assert(r.body.length === 10, `Expected 10, got ${r.body.length}`);
  });

  await test('GET /api/clients returns 5 clients', async () => {
    const r = await get('/api/clients');
    assert(r.body.length === 5, `Expected 5, got ${r.body.length}`);
  });

  await test('Invoice status distribution: 4 paid, 3 sent, 2 overdue, 1 draft', async () => {
    const r = await get('/api/invoices');
    const counts = {};
    r.body.forEach(i => counts[i.status] = (counts[i.status]||0)+1);
    assert(counts.paid===4, `paid: ${counts.paid}`);
    assert(counts.sent===3, `sent: ${counts.sent}`);
    assert(counts.overdue===2, `overdue: ${counts.overdue}`);
    assert(counts.draft===1, `draft: ${counts.draft}`);
  });

  await test('5 clients have complete data', async () => {
    const r = await get('/api/clients');
    r.body.forEach(c => {
      assert(c.name && c.email && c.address && c.phone, `Incomplete client: ${c.name}`);
    });
  });

  await test('Invoice numbers are unique', async () => {
    const r = await get('/api/invoices');
    const nums = r.body.map(i => i.invoice_number);
    assert(new Set(nums).size === nums.length, 'Duplicate invoice numbers');
  });

  // API tests
  console.log('\n🔌 API Tests:');
  await test('POST /api/invoices creates new invoice', async () => {
    const r = await req('POST', '/api/invoices', {
      client_name: 'Test Corp', items: [{desc:'Test Service',qty:2,rate:100}],
      tax_rate: 13, discount: 0
    });
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.body.id, 'No id returned');
    assert(r.body.invoice_number, 'No invoice_number');
  });

  await test('GET /api/invoices now returns 11', async () => {
    const r = await get('/api/invoices');
    assert(r.body.length === 11, `Expected 11, got ${r.body.length}`);
  });

  await test('PUT /api/invoices/:id updates status', async () => {
    const r = await req('PUT', '/api/invoices/1', { status: 'sent' });
    assert(r.status === 200 && r.body.success, 'Update failed');
    const check = await get('/api/invoices/1');
    assert(check.body.status === 'sent', `Status is ${check.body.status}`);
    // Restore
    await req('PUT', '/api/invoices/1', { status: 'paid' });
  });

  await test('DELETE /api/invoices/:id deletes invoice', async () => {
    // Delete the test invoice we created
    const all = await get('/api/invoices');
    const testInv = all.body.find(i => i.client_name === 'Test Corp');
    assert(testInv, 'Test invoice not found');
    const r = await del(`/api/invoices/${testInv.id}`);
    assert(r.body.success, 'Delete failed');
  });

  await test('GET /api/invoices back to 10', async () => {
    const r = await get('/api/invoices');
    assert(r.body.length === 10, `Expected 10, got ${r.body.length}`);
  });

  await test('GET /api/invoices/1/pdf returns valid PDF', async () => {
    const r = await get('/api/invoices/1/pdf');
    assert(r.status === 200, `Status ${r.status}`);
    assert(r.headers['content-type'] === 'application/pdf', `CT: ${r.headers['content-type']}`);
    assert(r.body.slice(0, 5).toString() === '%PDF-', 'Not a PDF');
  });

  await test('GET /api/stats returns correct numbers', async () => {
    const r = await get('/api/stats');
    assert(r.body.total_revenue > 0, 'No revenue');
    assert(r.body.pending > 0, 'No pending');
    assert(r.body.overdue > 0, 'No overdue');
  });

  // Data integrity
  console.log('\n🔒 Data Integrity Tests:');
  await test('Amount calculation correct (subtotal + tax - discount = total)', async () => {
    const r = await get('/api/invoices');
    r.body.forEach(inv => {
      const expected = inv.subtotal - inv.discount + inv.tax_amount;
      assert(Math.abs(inv.total - expected) < 0.01, `Invoice ${inv.invoice_number}: ${inv.total} != ${expected}`);
    });
  });

  await test('Invalid status rejected', async () => {
    const r = await req('POST', '/api/invoices', {
      client_name: 'Test', items: [{desc:'x',qty:1,rate:1}], status: 'invalid'
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`📊 Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(failed === 0 ? '🎉 ALL TESTS PASSED!' : '💥 SOME TESTS FAILED');
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
