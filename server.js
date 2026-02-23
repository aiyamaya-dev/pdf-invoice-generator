const express = require('express');
const path = require('path');
const { generateInvoicePDF } = require('./invoice');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
app.listen(PORT, () => console.log(`📄 Invoice Generator running on http://localhost:${PORT}`));
