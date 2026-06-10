import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { logExpense } from "@/lib/expenses.functions";
import { Sparkles, Send, Wallet, TrendingUp, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PesaHub" }] }),
  component: Dashboard,
});

type Expense = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  raw_text: string;
  spent_at: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink": "oklch(0.72 0.15 75)",
  Transport: "oklch(0.65 0.18 30)",
  Shopping: "oklch(0.6 0.15 260)",
  "Bills & Utilities": "oklch(0.7 0.15 320)",
  Groceries: "oklch(0.58 0.16 152)",
  Entertainment: "oklch(0.68 0.18 200)",
  Health: "oklch(0.68 0.18 0)",
  "Rent & Housing": "oklch(0.5 0.12 270)",
  Education: "oklch(0.62 0.15 110)",
  Other: "oklch(0.6 0.02 160)",
};

function Dashboard() {
  const router = useRouter();
  const logExpenseFn = useServerFn(logExpense);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [name, setName] = useState<string>("there");

  async function load() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("spent_at", { ascending: false })
      .limit(50);
    setExpenses((data ?? []) as Expense[]);
  }

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => {
      const dn = (data.user?.user_metadata as { display_name?: string } | null)?.display_name;
      if (dn) setName(dn);
      else if (data.user?.email) setName(data.user.email.split("@")[0]);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await logExpenseFn({ data: { text: text.trim() } });
      setText("");
      toast.success("Expense logged");
      await load();
      router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log expense");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setExpenses((e) => e.filter((x) => x.id !== id));
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = expenses.filter((e) => new Date(e.spent_at) >= monthStart);
  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const today = expenses.filter((e) => new Date(e.spent_at).toDateString() === now.toDateString());
  const todayTotal = today.reduce((s, e) => s + Number(e.amount), 0);
  const txCount = thisMonth.length;

  const examples = [
    "Spent 450 KES on lunch at the cafe",
    "Matatu fare 120",
    "Bought groceries at Naivas for 2,300",
    "Paid 1,500 for KPLC tokens",
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Good {greet()},</div>
          <h1 className="text-3xl font-bold tracking-tight capitalize">{name} 👋</h1>
        </div>
      </div>

      {/* Overview cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="This month" value={fmt(monthTotal)} icon={Wallet} highlight />
        <StatCard label="Today" value={fmt(todayTotal)} icon={TrendingUp} />
        <StatCard label="Transactions this month" value={String(txCount)} icon={Receipt} />
      </div>

      {/* Quick log */}
      <div className="mt-8 rounded-3xl border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Log an expense — just type it
        </div>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Spent 450 KES on lunch and soda at the cafe"
            className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? "Logging…" : "Log"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setText(ex)}
              className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent transactions</h2>
          <span className="text-xs text-muted-foreground">{expenses.length} total</span>
        </div>
        {expenses.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
            No expenses yet — log your first one above.
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <div
                key={e.id}
                className="group flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-card transition hover:shadow-glow"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-xl text-sm font-bold text-primary-foreground"
                    style={{ backgroundColor: CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.Other }}
                  >
                    {e.category[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{e.description || e.raw_text}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.category} · {new Date(e.spent_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold">- {e.currency} {Number(e.amount).toLocaleString()}</div>
                  <button
                    onClick={() => remove(e.id)}
                    className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 shadow-card ${
        highlight ? "bg-gradient-hero text-primary-foreground" : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`text-xs ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
        <Icon className={`h-4 w-4 ${highlight ? "text-primary-foreground/80" : "text-primary"}`} />
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function fmt(v: number) {
  return `KES ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function greet() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
