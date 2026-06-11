## What we're building

Upgrade PesaHub from a basic expense logger into a full money-tracker tailored for Kenya: M-Pesa + bank SMS parsing, receipt photo scanning, structured manual entry for income/savings/loans, and an AI-generated Financial Health Score.

## Step 1 — Unified `transactions` table (migration)

Replace the `expenses` table with a single `transactions` table:

- `type`: `expense` | `income` | `savings` | `loan` | `transfer`
- `amount` (numeric, always positive), `currency` (default KES)
- `category` (Rent, Transport, Shopping, Food, Entertainment, School Fees, Utilities, Salary, Business, Loan, Savings, Other)
- `source`: `ai_text` | `sms` | `receipt` | `manual`
- `merchant`, `description`, `raw_text`, `spent_at`
- `metadata` jsonb (line items from receipts, SMS sender bank, etc.)

RLS scoped to `auth.uid()`. Existing `expenses` rows migrated into `transactions` as `type='expense'`. Old table dropped.

## Step 2 — Server functions (`src/lib/transactions.functions.ts`)

All AI runs via Lovable AI Gateway (`google/gemini-3-flash-preview` for text, `google/gemini-2.5-pro` for receipt vision) inside `createServerFn` with `requireSupabaseAuth`:

- `logFromText` — natural language (kept from current logger, schema upgraded)
- `logFromSms` — parses M-Pesa / KCB / Equity / Co-op / Absa / NCBA / StanChart / Airtel Money SMS. Detects debit vs credit, amount, merchant, auto-categorizes (Uber → Transport, KPLC → Utilities, etc.)
- `logFromReceipt` — accepts base64 image, Gemini vision extracts amount, date, merchant, line items
- `createManual` — Zod-validated structured insert for cash/salary/business income/loan/savings
- `getHealthScore` — computes savings rate, spending volatility, debt ratio, budget adherence over last 30 days; AI generates one actionable tip ("Reduce restaurant spending by KES 2,000…")

## Step 3 — Dashboard UI (`_authenticated.dashboard.tsx`)

Tabbed logger replacing the single AI input:

```text
[ AI Text ] [ Paste SMS ] [ Scan Receipt ] [ Manual ]
```

- **AI Text** — current behaviour
- **Paste SMS** — textarea + "Parse SMS" button, preview parsed result before saving
- **Scan Receipt** — file input (camera capture on mobile), preview, AI extracts → editable confirm card
- **Manual** — segmented control (Expense / Income / Savings / Loan) + amount, category, date, note

Below the logger: recent transactions feed (color-coded by type), and a new **Health Score card** (big number / 100, ring chart, AI tip).

## Step 4 — Analytics page

Keep existing charts; add income vs expense bar, savings rate trend, and breakdown by source (SMS / receipt / manual / AI).

## Technical notes

- Receipt images are sent inline as base64 to Gemini via the OpenAI-compatible chat completions multimodal format (`image_url` content blocks) — no storage bucket needed for v1.
- SMS parser uses a strict Zod schema with `Output.object` so the model returns structured fields, with fallback regex for amount/merchant if AI fails.
- Health score is recomputed on demand (cached 5 min client-side via TanStack Query) — no cron needed yet.
- All categorization rules live in a single `CATEGORY_HINTS` constant injected into prompts so we get consistent buckets.

## Out of scope for this iteration

- Real-time SMS auto-import (browsers can't read SMS — would need a companion Android app)
- Receipt image storage (kept ephemeral; only extracted data is saved)
- Budgets table (Health Score uses sensible defaults until budgets ship)
