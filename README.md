# 📄 PDF Invoice Generator

**By [AIyamaya Dev](https://github.com/aiyamaya-dev)** | Portfolio Demo

A clean, REST API-driven invoice generator that creates professional PDF invoices from JSON data. Perfect for small businesses, freelancers, and SaaS billing systems.

## 🎯 Use Case

Every business needs invoices. This tool lets you generate branded PDF invoices via API call or web form — integrate into any billing workflow.

## ✨ Features

- **REST API** — `POST /api/invoice` with JSON, get PDF back
- **Web Form** — Fill in details, download instantly
- **Professional Templates** — Clean, modern invoice layout
- **Auto-calculations** — Tax, subtotals, discounts
- **Multi-currency** — USD, EUR, CAD, GBP support
- **Company Branding** — Custom logo, colors, footer

## 🛠 Tech Stack

- **Backend:** Node.js + Express
- **PDF Generation:** PDFKit (zero external dependencies)
- **Frontend:** Vanilla HTML/CSS form

## 🚀 Quick Start

```bash
npm install
npm run dev     # http://localhost:3002
```

## API Usage

```bash
curl -X POST http://localhost:3002/api/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Acme Corp",
    "client": "John Doe",
    "items": [{"desc": "Web Development", "qty": 40, "rate": 75}],
    "tax": 13
  }' --output invoice.pdf
```

---

*Built by AIyamaya Dev — Full-stack development & automation services*
