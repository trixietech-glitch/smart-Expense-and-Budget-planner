import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — PesaHub" }] }),
  component: Analytics,
});

type Expense = { amount: number; category: string; spent_at: string };

const COLORS = [
  "oklch(0.58 0.16 152)",
  "oklch(0.72 0.15 75)",
  "oklch(0.65 0.18 30)",
  "oklch(0.6 0.15 260)",
  "oklch(0.7 0.15 320)",
  "oklch(0.68 0.18 200)",
  "oklch(0.68 0.18 0)",
  "oklch(0.5 0.12 270)",
];

function Analytics() {
  const [rows, setRows] = useState<Expense[]>([]);

  useEffect(() => {
    supabase
      .from("expenses")
      .select("amount,category,spent_at")
      .order("spent_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setRows((data ?? []) as Expense[]));
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount)));
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      m.set(d.toISOString().slice(0, 10), 0);
    }
    rows.forEach((r) => {
      const k = new Date(r.spent_at).toISOString().slice(0, 10);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + Number(r.amount));
    });
    return Array.from(m.entries()).map(([date, amount]) => ({
      date: date.slice(5),
      amount: Math.round(amount),
    }));
  }, [rows]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
      <p className="mt-1 text-muted-foreground">Where your money actually goes.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-glow">
          <div className="text-xs opacity-80">Total tracked</div>
          <div className="mt-2 text-3xl font-bold">KES {total.toLocaleString()}</div>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          <div className="text-xs text-muted-foreground">Categories used</div>
          <div className="mt-2 text-3xl font-bold">{byCategory.length}</div>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          <div className="text-xs text-muted-foreground">Transactions</div>
          <div className="mt-2 text-3xl font-bold">{rows.length}</div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold">Expenses by category</h2>
          {byCategory.length === 0 ? (
            <Empty />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="h-[200px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `KES ${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2 self-center text-sm">
                {byCategory.map((c, i) => {
                  const pct = total ? Math.round((c.value / total) * 100) : 0;
                  return (
                    <li key={c.name} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {c.name}
                      </span>
                      <span className="text-muted-foreground">
                        KES {c.value.toLocaleString()} · {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold">Last 14 days</h2>
          {rows.length === 0 ? (
            <Empty />
          ) : (
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.015 150)" />
                  <XAxis dataKey="date" stroke="oklch(0.5 0.02 160)" fontSize={11} />
                  <YAxis stroke="oklch(0.5 0.02 160)" fontSize={11} />
                  <Tooltip formatter={(v: number) => `KES ${v.toLocaleString()}`} />
                  <Bar dataKey="amount" fill="oklch(0.58 0.16 152)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Empty() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed bg-background/40 p-8 text-center text-sm text-muted-foreground">
      Log a few expenses to see insights here.
    </div>
  );
}
