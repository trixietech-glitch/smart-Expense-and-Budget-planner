import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

const InsightSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().min(2).max(80),
        body: z.string().min(2).max(280),
        severity: z.enum(["good", "info", "warn", "alert"]),
        category: z.string().max(60).optional().default(""),
        action: z.string().max(120).optional().default(""),
      }),
    )
    .min(2)
    .max(6),
});

type Insight = z.infer<typeof InsightSchema>["insights"][number];

export const getAiInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 30);
    const start60 = new Date(now);
    start60.setDate(start60.getDate() - 60);

    const [{ data: tx }, { data: budgets }, { data: subs }, { data: debts }, { data: goals }] = await Promise.all([
      context.supabase
        .from("transactions")
        .select("type,amount,category,merchant,spent_at")
        .gte("spent_at", start60.toISOString()),
      context.supabase.from("budgets").select("category,monthly_limit"),
      context.supabase.from("subscriptions").select("name,amount,billing_cycle,active,next_renewal"),
      context.supabase.from("debts").select("name,balance,minimum_payment,interest_rate,status"),
      context.supabase.from("savings_goals").select("name,target_amount,current_amount,target_date"),
    ]);

    const rows = (tx ?? []) as Array<{
      type: string;
      amount: number;
      category: string;
      merchant: string | null;
      spent_at: string;
    }>;

    const within = (r: { spent_at: string }, from: Date, to: Date) => {
      const d = new Date(r.spent_at);
      return d >= from && d < to;
    };

    const last30 = rows.filter((r) => within(r, start30, now));
    const prev30 = rows.filter((r) => within(r, start60, start30));

    const sumBy = (list: typeof rows, t: string) =>
      list.filter((r) => r.type === t).reduce((s, r) => s + Number(r.amount), 0);

    const income30 = sumBy(last30, "income");
    const expense30 = sumBy(last30, "expense");
    const savings30 = sumBy(last30, "savings");
    const expensePrev = sumBy(prev30, "expense");

    const catTotals = (list: typeof rows) => {
      const m = new Map<string, number>();
      list
        .filter((r) => r.type === "expense")
        .forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount)));
      return m;
    };
    const cur = catTotals(last30);
    const prev = catTotals(prev30);
    const categoryDeltas = Array.from(cur.entries())
      .map(([cat, amt]) => {
        const before = prev.get(cat) ?? 0;
        const pct = before > 0 ? ((amt - before) / before) * 100 : amt > 0 ? 100 : 0;
        return { category: cat, current: Math.round(amt), previous: Math.round(before), pctChange: Math.round(pct) };
      })
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
      .slice(0, 5);

    const budgetStatus = (budgets ?? []).map((b) => {
      const spent = cur.get(b.category) ?? 0;
      const limit = Number(b.monthly_limit);
      return {
        category: b.category,
        limit: Math.round(limit),
        spent: Math.round(spent),
        pct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
      };
    });

    const monthlySubs = (subs ?? [])
      .filter((s) => s.active)
      .reduce((sum, s) => {
        const a = Number(s.amount);
        const factor = s.billing_cycle === "yearly" ? 1 / 12 : s.billing_cycle === "weekly" ? 4.33 : 1;
        return sum + a * factor;
      }, 0);

    const activeDebts = (debts ?? []).filter((d) => d.status !== "paid");
    const totalDebt = activeDebts.reduce((s, d) => s + Number(d.balance), 0);
    const minPayments = activeDebts.reduce((s, d) => s + Number(d.minimum_payment ?? 0), 0);

    const goalsSummary = (goals ?? []).map((g) => ({
      name: g.name,
      pct: g.target_amount > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0,
      remaining: Math.round(Number(g.target_amount) - Number(g.current_amount)),
      target_date: g.target_date,
    }));

    const summary = {
      income30: Math.round(income30),
      expense30: Math.round(expense30),
      savings30: Math.round(savings30),
      expensePrev30: Math.round(expensePrev),
      expenseDeltaPct:
        expensePrev > 0 ? Math.round(((expense30 - expensePrev) / expensePrev) * 100) : null,
      savingsRate: income30 > 0 ? Math.round((savings30 / income30) * 100) : 0,
      monthlySubscriptions: Math.round(monthlySubs),
      totalDebt: Math.round(totalDebt),
      minDebtPayments: Math.round(minPayments),
      categoryDeltas,
      budgetStatus,
      goals: goalsSummary,
    };

    // Fallback heuristic insights so the page is useful even without AI / data.
    const fallback: Insight[] = [];
    if (last30.length === 0) {
      fallback.push({
        title: "Start logging transactions",
        body: "Add a few expenses or paste an M-Pesa SMS so PesaHub can analyse your spending.",
        severity: "info",
        category: "",
        action: "Log a transaction from the dashboard.",
      });
    } else {
      if (summary.savingsRate < 10) {
        fallback.push({
          title: `Savings rate is ${summary.savingsRate}%`,
          body: `Aim for at least 20% of income (KES ${summary.income30.toLocaleString()}). Try moving KES ${Math.round(summary.income30 * 0.1).toLocaleString()} to savings now.`,
          severity: summary.savingsRate < 5 ? "alert" : "warn",
          category: "Savings",
          action: "Open Goals and add a contribution.",
        });
      } else {
        fallback.push({
          title: `Healthy ${summary.savingsRate}% savings rate`,
          body: `You saved KES ${summary.savings30.toLocaleString()} this month — keep the streak going.`,
          severity: "good",
          category: "Savings",
          action: "",
        });
      }
      const over = budgetStatus.filter((b) => b.pct >= 100);
      if (over.length) {
        fallback.push({
          title: `${over.length} budget${over.length > 1 ? "s" : ""} blown`,
          body: over.map((o) => `${o.category} ${o.pct}%`).join(", ") + ". Review and tighten next month.",
          severity: "alert",
          category: over[0].category,
          action: "Open Budgets to adjust limits.",
        });
      }
      const surge = categoryDeltas.find((c) => c.pctChange >= 30 && c.current > 1000);
      if (surge) {
        fallback.push({
          title: `${surge.category} up ${surge.pctChange}%`,
          body: `KES ${surge.current.toLocaleString()} this month vs KES ${surge.previous.toLocaleString()} last month.`,
          severity: "warn",
          category: surge.category,
          action: "",
        });
      }
      if (summary.monthlySubscriptions > 0 && summary.monthlySubscriptions > summary.income30 * 0.1) {
        fallback.push({
          title: "Subscriptions are eating your income",
          body: `KES ${summary.monthlySubscriptions.toLocaleString()}/month in subscriptions — over 10% of income. Cancel ones you don't use.`,
          severity: "warn",
          category: "Subscriptions",
          action: "Open Subs and pause unused ones.",
        });
      }
    }

    let insights: Insight[] = fallback;
    try {
      const gateway = getGateway();
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system:
          "You are PesaHub, a friendly Kenyan personal-finance coach. Given a JSON snapshot of the user's last 30 days, produce 3-5 short, specific, actionable insights. " +
          "Always reference KES amounts and category names from the data. Severity: 'good' for wins, 'info' for neutral, 'warn' for concerns, 'alert' for urgent. " +
          "Include a brief 'action' the user can take inside the app (Budgets, Goals, Subs, Debts). No emojis, no preamble, no markdown.",
        prompt: `Snapshot:\n${JSON.stringify(summary)}`,
        experimental_output: Output.object({ schema: InsightSchema }),
      });
      if (experimental_output?.insights?.length) {
        insights = experimental_output.insights;
      }
    } catch {
      // keep fallback
    }

    return { summary, insights };
  });
