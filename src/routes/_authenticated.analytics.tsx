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
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — PesaHub" }] }),
  component: Analytics,
});

type Tx = {
  type: "expense" | "income" | "savings" | "loan" | "transfer";
  amount: number;
  category: string;
  source: string;
  spent_at: string;
};

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
  const [rows, setRows] = useState<Tx[]>([]);

  useEffect(() => {
    supabase
      .from("transactions")
      .select("type,amount,category,source,spent_at")
      .order("spent_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => setRows((data ?? []) as unknown as Tx[]));
  }, []);

  const expenses = rows.filter((r) => r.type === "expense");
  const income = rows.filter((r) => r.type === "income");
  const savings = rows.filter((r) => r.type === "savings");

  const totalExpense = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalSavings = savings.reduce((s, r) => s + Number(r.amount), 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount)));
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const byDay = useMemo(() => {
    const inc = new Map<string, number>();
    const exp = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      inc.set(k, 0);
      exp.set(k, 0);
    }
    rows.forEach((r) => {
      const k = new Date(r.spent_at).toISOString().slice(0, 10);
      if (r.type === "income" && inc.has(k)) inc.set(k, (inc.get(k) ?? 0) + Number(r.amount));
      if (r.type === "expense" && exp.has(k)) exp.set(k, (exp.get(k) ?? 0) + Number(r.amount));
    });
    return Array.from(exp.keys()).map((k) => ({
      date: k.slice(5),
      Income: Math.round(inc.get(k) ?? 0),
      Expense: Math.round(exp.get(k) ?? 0),
    }));
  }, [rows]);

  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.source, (m.get(r.source) ?? 0) + 1));
    return Array.from(m.entries()).map(([name, value]) => ({
      name: name === "ai_text" ? "AI" : name === "sms" ? "SMS" : name === "receipt" ? "Receipt" : "Manual",
      value,
    }));
  }, [rows]);

  const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
      <p className="mt-1 text-muted-foreground">Where your money actually goes.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Income" value={`KES ${totalIncome.toLocaleString()}`} accent />
        <Stat label="Expenses" value={`KES ${totalExpense.toLocaleString()}`} />
        <Stat label="Savings" value={`KES ${totalSavings.toLocaleString()}`} />
        <Stat label="Savings rate" value={`${savingsRate}%`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="Expenses by category">
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
                {byCategory.slice(0, 8).map((c, i) => {
                  const pct = totalExpense ? Math.round((c.value / totalExpense) * 100) : 0;
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
        </Card>

        <Card title="Income vs expense — last 14 days">
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
                  <Legend />
                  <Bar dataKey="Income" fill="oklch(0.58 0.16 152)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Expense" fill="oklch(0.65 0.18 30)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="How transactions are captured">
          {bySource.length === 0 ? (
            <Empty />
          ) : (
            <div className="mt-4 h-[220px]">
              <ResponsiveContainer>
                <BarChart data={bySource} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.015 150)" />
                  <XAxis type="number" stroke="oklch(0.5 0.02 160)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="oklch(0.5 0.02 160)" fontSize={11} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="oklch(0.6 0.15 260)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Totals">
          <ul className="mt-4 space-y-3 text-sm">
            <Row label="Total income" value={`KES ${totalIncome.toLocaleString()}`} />
            <Row label="Total expenses" value={`KES ${totalExpense.toLocaleString()}`} />
            <Row label="Total saved" value={`KES ${totalSavings.toLocaleString()}`} />
            <Row label="Transactions" value={String(rows.length)} />
          </ul>
        </Card>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-card">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-card ${accent ? "bg-gradient-hero text-primary-foreground" : "bg-card"}`}
    >
      <div className={`text-xs ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between border-b pb-2 last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </li>
  );
}

function Empty() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed bg-background/40 p-8 text-center text-sm text-muted-foreground">
      Log a few transactions to see insights here.
    </div>
  );
}
