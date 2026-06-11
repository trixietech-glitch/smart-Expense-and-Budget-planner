import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const TX_TYPES = ["expense", "income", "savings", "loan", "transfer"] as const;

export const EXPENSE_CATEGORIES = [
  "Food & Drink",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Rent & Housing",
  "Entertainment",
  "Health",
  "Education",
  "School Fees",
  "Airtime & Data",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Business",
  "Freelance",
  "Gift",
  "Other Income",
] as const;

export const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  "Savings",
  "Loan",
  "Transfer",
] as const;

const CATEGORY_HINTS = `Categories you may use:
- Expenses: Food & Drink, Groceries, Transport (matatu, Uber, Bolt, fuel, fare), Shopping, Bills & Utilities (KPLC, water, internet), Rent & Housing, Entertainment (Netflix, bars, movies), Health (hospital, pharmacy), Education, School Fees, Airtime & Data (Safaricom, Airtel), Other.
- Income: Salary, Business, Freelance, Gift, Other Income.
- Savings: Savings (deposits to MMF, sacco, bank savings, M-Shwari lock).
- Loan: Loan (Fuliza, KCB M-Pesa, bank loan disbursed or repaid).`;

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

// ---------------- Deterministic M-Pesa / Airtel Money parser ----------------
type LocalParsed = {
  type: "expense" | "income" | "savings" | "loan" | "transfer";
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  description: string;
  bank: string;
};

function categorize(merchant: string, fallback: string): string {
  const m = merchant.toLowerCase();
  if (/(uber|bolt|little cab|matatu|fare|shell|total|rubis|petrol|fuel|ola energy)/.test(m)) return "Transport";
  if (/(kplc|kenya power|nairobi water|zuku|safaricom home|faiba|jtl|telkom)/.test(m)) return "Bills & Utilities";
  if (/(naivas|carrefour|quickmart|chandarana|tuskys|magunas|cleanshelf|game stores)/.test(m)) return "Groceries";
  if (/(java|kfc|pizza|burger|cafe|coffee|chicken inn|galitos|big square|artcaffe|naked pizza|ocha|nyama)/.test(m)) return "Food & Drink";
  if (/(netflix|dstv|showmax|spotify|gotv|startimes)/.test(m)) return "Entertainment";
  if (/(school|university|college|academy|fees)/.test(m)) return "School Fees";
  if (/(hospital|clinic|pharmacy|chemist|goodlife|medplus|aga khan|nairobi hospital|mp shah)/.test(m)) return "Health";
  if (/(airtime|bundles|data|safaricom prepay|okoa jahazi)/.test(m)) return "Airtime & Data";
  return fallback;
}

function parseAmount(raw: string): number | null {
  const m = raw.match(/(?:Ksh|KES|Ksh\.|KSh)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

export function localParseSms(sms: string): LocalParsed | null {
  const s = sms.trim();
  if (!s) return null;

  const isMpesa = /m-?pesa/i.test(s) || /^[A-Z0-9]{8,12}\s+Confirmed\b/i.test(s) || /Fuliza/i.test(s);
  if (isMpesa) {
    const amount = parseAmount(s);
    if (!amount) return null;
    const bank = "M-Pesa";

    let m = s.match(/received\s+(?:Ksh|KES)\s*[\d,.]+\s+from\s+([A-Z0-9 .'&\-]+?)\s+(?:\d{7,12}|on\s)/i);
    if (m) {
      const merchant = m[1].trim();
      return { type: "income", amount, currency: "KES", category: "Other Income", merchant, description: `Received from ${merchant}`, bank };
    }
    m = s.match(/paid\s+to\s+([A-Z0-9 .'&\-]+?)(?:\s+(?:on|for|acc|account)\b|\.)/i);
    if (m) {
      const merchant = m[1].trim();
      return { type: "expense", amount, currency: "KES", category: categorize(merchant, "Shopping"), merchant, description: `Paid ${merchant}`, bank };
    }
    m = s.match(/sent\s+to\s+([A-Z0-9 .'&\-]+?)\s+(?:\d{7,12}|on\s)/i);
    if (m) {
      const merchant = m[1].trim();
      return { type: "expense", amount, currency: "KES", category: "Other", merchant, description: `Sent to ${merchant}`, bank };
    }
    if (/withdraw/i.test(s)) {
      const agent = s.match(/from\s+([A-Z0-9 .'&\-]+?)(?:\s+New|\.)/i);
      return { type: "expense", amount, currency: "KES", category: "Other", merchant: agent?.[1].trim() || "M-Pesa agent", description: "Withdrawal", bank };
    }
    if (/airtime/i.test(s)) {
      return { type: "expense", amount, currency: "KES", category: "Airtime & Data", merchant: "Safaricom", description: "Airtime purchase", bank };
    }
    if (/Fuliza/i.test(s) && /(repaid|outstanding|deducted)/i.test(s)) {
      return { type: "loan", amount, currency: "KES", category: "Loan", merchant: "Fuliza", description: "Fuliza repayment", bank };
    }
    return null;
  }

  const isAirtel = /airtel\s*money/i.test(s) || /^You have (paid|sent|received)\b/i.test(s);
  if (isAirtel) {
    const amount = parseAmount(s);
    if (!amount) return null;
    const bank = "Airtel Money";

    let m = s.match(/(?:You have\s+)?paid\s+(?:Ksh|KES)\s*[\d,.]+\s+to\s+([A-Z0-9 .'&\-]+?)(?:\s+on|\.|,)/i);
    if (m) {
      const merchant = m[1].trim();
      return { type: "expense", amount, currency: "KES", category: categorize(merchant, "Shopping"), merchant, description: `Paid ${merchant}`, bank };
    }
    m = s.match(/(?:You have\s+)?sent\s+(?:Ksh|KES)\s*[\d,.]+\s+to\s+([A-Z0-9 .'&\-]+?)(?:\s+on|\.|,)/i);
    if (m) {
      const merchant = m[1].trim();
      return { type: "expense", amount, currency: "KES", category: "Other", merchant, description: `Sent to ${merchant}`, bank };
    }
    m = s.match(/(?:You have\s+)?received\s+(?:Ksh|KES)\s*[\d,.]+\s+from\s+([A-Z0-9 .'&\-]+?)(?:\s+on|\.|,)/i);
    if (m) {
      const merchant = m[1].trim();
      return { type: "income", amount, currency: "KES", category: "Other Income", merchant, description: `Received from ${merchant}`, bank };
    }
    if (/airtime|bundle|data/i.test(s)) {
      return { type: "expense", amount, currency: "KES", category: "Airtime & Data", merchant: "Airtel", description: "Airtime/data", bank };
    }
    return null;
  }

  return null;
}

function splitSmsBatch(input: string): string[] {
  const byBlank = input.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  if (byBlank.length > 1) return byBlank;
  const lines = input.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length <= 1) return [input.trim()].filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (/^[A-Z0-9]{8,12}\s+Confirmed\b/i.test(line) || /^You have\s+(paid|sent|received)/i.test(line)) {
      if (cur) chunks.push(cur.trim());
      cur = line;
    } else {
      cur = cur ? `${cur} ${line}` : line;
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

// ---------------- AI text logger ----------------
const ParsedText = z.object({
  type: z.enum(TX_TYPES),
  amount: z.number().positive(),
  currency: z.string().default("KES"),
  category: z.string(),
  merchant: z.string().optional().default(""),
  description: z.string(),
});

export const logFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(2).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const gateway = getGateway();
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You parse short natural-language money statements for a Kenyan personal-finance app (PesaHub). " +
        "Decide the transaction type (expense/income/savings/loan/transfer), extract amount in KES, pick the single best category, a short merchant if present, and a 2-6 word description. " +
        "Default currency to KES. Never invent amounts.\n" + CATEGORY_HINTS,
      prompt: `Parse: "${data.text}"`,
      experimental_output: Output.object({ schema: ParsedText }),
    });
    const p = experimental_output;

    const { data: row, error } = await context.supabase
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: p.type,
        amount: p.amount,
        currency: p.currency || "KES",
        category: p.category,
        merchant: p.merchant || null,
        description: p.description,
        raw_text: data.text,
        source: "ai_text",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- SMS parser ----------------
const ParsedSms = z.object({
  type: z.enum(TX_TYPES),
  amount: z.number().positive(),
  currency: z.string().default("KES"),
  category: z.string(),
  merchant: z.string().optional().default(""),
  description: z.string(),
  bank: z.string().optional().default(""),
});

export const logFromSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sms: z.string().min(5).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const gateway = getGateway();
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You parse Kenyan financial SMS alerts (M-Pesa, Airtel Money, KCB, Equity, Co-op, Absa, NCBA, Standard Chartered, etc.) into structured data. " +
        "Determine transaction type: 'expense' for payments/withdrawals/debits/card payments, 'income' for received/credit/salary/deposits, 'savings' for lock savings/MMF deposit, 'loan' for Fuliza/loan disbursement/repayment, 'transfer' for own-account moves. " +
        "Extract the numeric amount (strip commas), the merchant or sender if any, the bank/wallet name, and a short description. Auto-categorize: Uber/Bolt/matatu/fuel → Transport, KPLC/water/internet/Zuku/Safaricom Home → Bills & Utilities, supermarkets (Naivas/Carrefour/Quickmart) → Groceries, restaurants/Java/KFC → Food & Drink, Netflix/DStv → Entertainment, school/university → School Fees, hospital/pharmacy → Health, salary → Salary.\n" +
        CATEGORY_HINTS,
      prompt: `Parse this SMS:\n"""${data.sms}"""`,
      experimental_output: Output.object({ schema: ParsedSms }),
    });
    const p = experimental_output;

    const { data: row, error } = await context.supabase
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: p.type,
        amount: p.amount,
        currency: p.currency || "KES",
        category: p.category,
        merchant: p.merchant || null,
        description: p.description,
        raw_text: data.sms,
        source: "sms",
        metadata: { bank: p.bank || null },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- Receipt scanner ----------------
const ParsedReceipt = z.object({
  amount: z.number().positive(),
  currency: z.string().default("KES"),
  category: z.string(),
  merchant: z.string().optional().default(""),
  description: z.string(),
  spent_at: z.string().optional().default(""),
  items: z
    .array(z.object({ name: z.string(), price: z.number().optional() }))
    .optional()
    .default([]),
});

export const logFromReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        imageDataUrl: z.string().startsWith("data:image/").max(8_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const gateway = getGateway();
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-2.5-pro"),
      system:
        "You read photos of Kenyan receipts (supermarket, restaurant, fuel station, etc.) and extract structured data. " +
        "Return total amount in KES, merchant name, date (ISO if visible else empty string), category (Groceries for supermarkets, Food & Drink for restaurants, Transport for fuel, otherwise best match), short description, and line items if clearly readable.\n" +
        CATEGORY_HINTS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the receipt data." },
            { type: "image", image: data.imageDataUrl },
          ],
        },
      ],
      experimental_output: Output.object({ schema: ParsedReceipt }),
    });
    const p = experimental_output;

    const spent_at = p.spent_at && !isNaN(Date.parse(p.spent_at))
      ? new Date(p.spent_at).toISOString()
      : new Date().toISOString();

    const { data: row, error } = await context.supabase
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: "expense",
        amount: p.amount,
        currency: p.currency || "KES",
        category: p.category,
        merchant: p.merchant || null,
        description: p.description,
        raw_text: `Receipt: ${p.merchant || "unknown"}`,
        source: "receipt",
        spent_at,
        metadata: { items: p.items ?? [] },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- Manual entry ----------------
export const createManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        type: z.enum(TX_TYPES),
        amount: z.number().positive(),
        category: z.string().min(1).max(60),
        merchant: z.string().max(120).optional().default(""),
        description: z.string().max(200).optional().default(""),
        spent_at: z.string().optional(),
        currency: z.string().default("KES"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        category: data.category,
        merchant: data.merchant || null,
        description: data.description || data.category,
        raw_text: `${data.type} · ${data.category}`,
        source: "manual",
        spent_at: data.spent_at && !isNaN(Date.parse(data.spent_at))
          ? new Date(data.spent_at).toISOString()
          : new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- Delete ----------------
export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("transactions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Health score ----------------
export const getHealthScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: rows, error } = await context.supabase
      .from("transactions")
      .select("type,amount,category,spent_at")
      .gte("spent_at", since.toISOString());
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Array<{
      type: string;
      amount: number;
      category: string;
      spent_at: string;
    }>;

    const sum = (t: string) =>
      list.filter((r) => r.type === t).reduce((s, r) => s + Number(r.amount), 0);

    const income = sum("income");
    const expense = sum("expense");
    const savings = sum("savings");
    const loan = sum("loan");

    const savingsRate = income > 0 ? Math.min(1, savings / income) : 0;
    const spendRatio = income > 0 ? expense / income : expense > 0 ? 1.5 : 0;
    const debtRatio = income > 0 ? loan / income : loan > 0 ? 1 : 0;

    // 40 pts savings rate (target 20%), 35 pts spending control (target < 70% of income),
    // 15 pts debt control (target < 30% of income), 10 pts activity (>=10 tx in 30d).
    const sPts = Math.round(Math.min(1, savingsRate / 0.2) * 40);
    const spPts = Math.round(Math.max(0, Math.min(1, (1 - spendRatio) / 0.3 + 0.0)) * 35);
    const dPts = Math.round(Math.max(0, 1 - Math.min(1, debtRatio / 0.3)) * 15);
    const aPts = Math.round(Math.min(1, list.length / 10) * 10);
    const score = Math.max(0, Math.min(100, sPts + spPts + dPts + aPts));

    // Top expense category
    const catTotals = new Map<string, number>();
    list
      .filter((r) => r.type === "expense")
      .forEach((r) =>
        catTotals.set(r.category, (catTotals.get(r.category) ?? 0) + Number(r.amount)),
      );
    const topCat = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1])[0];

    // AI tip
    let tip = "Log a few more transactions so PesaHub can give sharper advice.";
    try {
      const gateway = getGateway();
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system:
          "You are PesaHub, a Kenyan personal-finance coach. Give ONE short, specific, actionable tip (max 25 words) using the user's numbers. Mention KES amounts. No emojis, no preamble.",
        prompt: `Score ${score}/100. Last 30 days: income KES ${Math.round(income)}, expenses KES ${Math.round(expense)}, savings KES ${Math.round(savings)}, loans KES ${Math.round(loan)}. Top spend category: ${topCat ? `${topCat[0]} (KES ${Math.round(topCat[1])})` : "none"}. Suggest the single best move to raise the score by ~10 points.`,
      });
      if (text?.trim()) tip = text.trim();
    } catch {
      // fall back to default tip
    }

    return {
      score,
      breakdown: { savingsRate, spendRatio, debtRatio, transactions: list.length },
      totals: { income, expense, savings, loan },
      topCategory: topCat ? { name: topCat[0], amount: topCat[1] } : null,
      tip,
    };
  });
