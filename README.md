# Foxion Business Management System

A production-quality internal business management application for **Foxion** built as a unified Next.js + MongoDB application for physical product ecommerce, inventory valuation, multi-marketplace orders, and double-entry style accounting books.

---

## 1. Overview & Architecture

Foxion operates an ecommerce brand selling dynamic physical goods (including rechargeable gas lighters, bluetooth speakers, kitchen choppers, and home appliances) across online marketplaces (Amazon, Meesho, Flipkart, Direct store, Instagram).

### Architecture Principles
- **Unified Single Next.js Application**: No separate NestJS/Express microservices or Redis infrastructure. Next.js App Router server capabilities handle database queries, business transactions, and Excel file streaming.
- **Single Source of Truth**: Business events are atomic:
  - **Sale (Order)**: Creates order record → Deducts product stock → Records chronological `StockMovement` (SALE) → Creates Ecommerce Account `Transaction` (Credit).
  - **Procurement (Purchase)**: Saves purchase invoice → Increments product stock → Records chronological `StockMovement` (PURCHASE) → Creates Main Account `Transaction` (Debit).
  - **Return**: Restores product stock → Records `StockMovement` (RETURN) → Creates accounting refund adjustment `Transaction` (Debit).
- **Two Logical Accounting Books in One Model**:
  - `MAIN`: General overhead, rent, salaries, utilities, marketing, capital, and inward inventory purchases.
  - `ECOMMERCE`: Marketplace payouts, sales receipts, platform commissions, customer refunds, and courier shipping.
- **Deterministic Running Balance**:
  $$\text{Current Balance} = \text{Previous Balance} + \text{Credit} - \text{Debit}$$
- **Strict Indian Business Calendar Dates (`DD/MM/YYYY`)**:
  - Consistent display across Android, iPhone, Windows, and macOS.
  - Anchored to Indian Standard Time (`Asia/Kolkata`) preventing UTC timezone day shifts.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: Strict TypeScript (no `any`)
- **Database**: MongoDB & Mongoose
- **Styling**: Tailwind CSS v4 & custom dark-mode business design system
- **UI Components**: shadcn/ui inspired primitives, Lucide React
- **Forms & Validation**: React Hook Form + Zod
- **Data Visualization**: Recharts (8 charts: revenue vs expenses, profit trend, category sales, platform sales, expense breakdown, inventory valuation, monthly trends)
- **Spreadsheet Processing**: XLSX (SheetJS)

---

## 3. Environment Variables

Create `.env.local` in the project root:

```env
# MongoDB Connection String (Atlas URI or local mongod)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/ecom?appName=Cluster

# Authentication Secret (min 32 chars long for JWT session verification)
AUTH_SECRET=foxion_super_secret_jwt_key_min_32_chars_long_foxion_2026

# App Base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Bill upload directory
UPLOAD_DIR=public/uploads
```

Refer to [`.env.example`](file:///.env.example) for a template.

---

## 4. Getting Started

### Installation
```bash
npm install
```

### Database Seeding
Seed admin account (`admin@foxion.in` / `admin123456`), standard product taxonomy, ecommerce platforms, and catalog products (Gas Lighter, Bluetooth Speaker, Kitchen Chopper):

```bash
npm run seed
```

### Local Development
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in:
- **Email**: `admin@foxion.in`
- **Password**: `admin123456`

---

## 5. Accounting Excel Template (16 Columns)

Both Excel Import and Excel Export conform to this 16-column template:

| # | Column Header | Type | Description |
|---|---|---|---|
| 1 | `Sl No` | Auto / Numeric | Sequential row number (1, 2, 3...) |
| 2 | `Date` | Date (`DD/MM/YYYY`) | Indian calendar date e.g. `17/09/2026` |
| 3 | `Description` | String | Narration / transaction details |
| 4 | `Category` | String | Account category head |
| 5 | `Debit` | Numeric | Expense / cash outflow |
| 6 | `Credit` | Numeric | Income / sales inflow |
| 7 | `Payment Mode` | Select | Bank Transfer, UPI, Cash, Card, Marketplace |
| 8 | `Bank/Cash` | Select | `Bank`, `Cash`, or `N/A` |
| 9 | `Party Name` | String | Vendor, supplier, or customer |
| 10 | `Invoice/orderId`| String | Reference invoice or order ID |
| 11 | `GST Applicable`| Boolean | `Yes` / `No` |
| 12 | `GST Amount` | Numeric | Tax component |
| 13 | `TDS/TCS` | Numeric | Tax deduction / collection |
| 14 | `Balance` | Auto / Numeric | Calculated running balance ($\text{Prev} + \text{Credit} - \text{Debit}$) |
| 15 | `Remarks` | String | Optional notes |
| 16 | `Bill Available`| Boolean | `Yes` / `No` |

---

## 6. Interactive Excel Import Workflow

The application supports a spreadsheet review and in-table correction flow:
1. **Upload**: User drops an `.xlsx` or `.xls` file.
2. **Parse & Validate**: Dates are parsed strictly as `DD/MM/YYYY` without browser locale distortion.
3. **In-Table Editable Preview**:
   - Direct cell editing with keyboard navigation (Enter to save, Esc to cancel).
   - Dynamic running balances recalculate immediately when debit or credit is modified.
   - `[ + Add Row ]`, `Duplicate Row`, and `Delete Row` actions.
   - Real-time row validation highlighting errors.
   - Filter by search keyword and `[ Show Errors Only ]`.
4. **Final Confirmation**: Displays summary modal showing total debit, total credit, modified row count, and verifies 0 errors before persisting.
5. **Database Insertion**: Atomic insertion into MongoDB with `ImportBatch` audit log.

---

## 7. Reports Suite

Located under `/reports`:
- **Profit & Loss**: Gross sales minus COGS, shipping, and marketplace fees to arrive at Gross Profit, minus operating overheads to arrive at Net Profit.
- **Sales Report**: Filterable by platform and date presets with per-item unit economics.
- **Purchases Report**: Inward procurement logs, supplier breakdown, and input tax credits (ITC).
- **Expense Report**: Categorical overhead distribution and payment channel (Bank vs Cash) analysis.
- **Inventory Valuation**: Current stock on hand at cost, holding valuation, and critical reorder alerts.
- **GST Report**: Output GST collected on sales vs Input Tax Credit on inward purchases.
- **Cash Flow**: Bank vs Cash liquidity movements.

---

## 8. Production Verification & Build

To check types and compile the optimized production bundle:

```bash
# Type check
npx tsc --noEmit

# Build production bundle
npm run build

# Start production server
npm run start
```
