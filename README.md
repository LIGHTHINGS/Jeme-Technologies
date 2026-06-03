# Odoo Customer Sync — Node.js

A Node.js + Express middleware that exposes four REST endpoints, allowing an external
web or mobile application to create and manage customer records and CRM pipeline leads
in Odoo SaaS — without requiring a custom Odoo module.

---

## How it works

Your client app talks to this Node.js server. This server authenticates with Odoo
using your API key and forwards every operation to Odoo via its built-in JSON-RPC API.

```
Client App  →  This Server (Node.js)  →  Odoo SaaS API
```

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/customer/create` | Creates a Contact and CRM lead — rejects if email exists |
| POST | `/api/customer/update-details` | Updates contact fields — returns 404 if not found |
| POST | `/api/customer/update-kyc` | Updates KYC status on an existing contact |
| POST | `/api/customer/update-lead-status` | Moves a CRM lead to a different pipeline stage |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PORT` | Port the server listens on (default: 3000) |
| `API_SECRET_TOKEN` | Bearer token your client app sends on every request |
| `ODOO_URL` | Your Odoo SaaS URL e.g. `https://yourcompany.odoo.com` |
| `ODOO_DB` | Your Odoo database name |
| `ODOO_USERNAME` | Email of the Odoo user the API key belongs to |
| `ODOO_API_KEY` | API key generated in Odoo (see below) |

### 3. Generate an Odoo API Key

In Odoo: **Settings → My Profile → Account Security → API Keys → New**

Use that key as `ODOO_API_KEY` in your `.env`.

### 4. Add custom fields in Odoo Studio

The KYC Status and Customer Type fields don't exist in Odoo by default.
Add them via **Settings → Studio → Contacts → Add a Field**:

| Field Label | Technical Name | Type |
|-------------|---------------|------|
| KYC Status | `x_kyc_status` | Selection (values: pending, in_review, completed, rejected) |
| Customer Type | `x_customer_type` | Text |

If you name them differently, update `ODOO_KYC_STATUS_FIELD` and
`ODOO_CUSTOMER_TYPE_FIELD` in your `.env`.

### 5. Start the server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

---

## Request Payloads

### POST /api/customer/create

```json
{
  "FirstName":    "Ada",
  "LastName":     "Okafor",
  "EmailAddress": "ada@example.com",
  "PhoneNumber":  "+2348012345678",
  "CustomerType": "Individual",
  "Address":      "14 Marina Street, Lagos",
  "KycStatus":    "Pending",
  "LeadStatus":   "New"
}
```

Success `201`:
```json
{ "success": true, "partner_id": 42, "lead_id": 7 }
```

---

### POST /api/customer/update-details

Only `CustomerEmail` is required. Include only the fields you want to update.
If you send `FirstName` or `LastName`, both are required.

```json
{
  "CustomerEmail": "ada@example.com",
  "PhoneNumber":   "+2348099999999",
  "Address":       "22 Broad Street, Lagos"
}
```

Success `200`:
```json
{ "success": true, "partner_id": 42 }
```

---

### POST /api/customer/update-kyc

```json
{
  "CustomerEmail": "ada@example.com",
  "KycStatus":     "Completed"
}
```

Success `200`:
```json
{ "success": true }
```

---

### POST /api/customer/update-lead-status

```json
{
  "CustomerEmail": "ada@example.com",
  "LeadStatus":    "Qualified"
}
```

Success `200`:
```json
{ "success": true }
```

---

## Authentication

Every request must include your `API_SECRET_TOKEN` as a Bearer token:

```
Authorization: Bearer your-secret-token
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Missing or invalid fields |
| 401 | Invalid or missing Bearer token |
| 404 | Customer, lead, or CRM stage not found |
| 409 | Email already exists (create only) |
| 500 | Server error — check console logs for `[CustomerSync]` entries |

---

## Notes

- CRM stage names must exist in Odoo before calling `update-lead-status`.
  Add or rename stages under **CRM → Configuration → Stages**.
- The Odoo session is cached in memory and automatically refreshed if it expires.
- All activity is logged to stdout with a `[CustomerSync]` prefix.
