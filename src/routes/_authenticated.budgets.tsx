import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, Trash2, Plus, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import {
  listBudgets,
  upsertBudget,
  deleteBudget,
  type BudgetStatus,
} from "@/lib/budgets.functions";
import { EXPENSE_CATEGORIES } from "@/lib/transactions.functions";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — PesaHub" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const listFn = useServerFn(listBudgets);
  const upsertFn = useServerFn(upsertBudget);
  const deleteFn = useServerFn(deleteBudget);

  const [rows, setRows] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await listFn();
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({ data: { category, monthly_limit: n, currency: "KES" } });
      setAmount("");
      toast.success(`Budget set for ${category}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteFn({ data: { id } });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  const totalLimit = rows.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent = rows.reduce((s, b) => s + b.spent, 0);
  const overCount = rows.filter((b) => b.status === "over").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Plan your spending</div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly budgets</h1>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">Total budgeted</div>
          <div className="font-bold">KES {totalLimit.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">
            Spent KES {totalSpent.toLocaleString()} ·{" "}
            {overCount > 0 ? (
              <span className="text-destructive">{overCount} over limit</span>
            ) : (
              <span>on track</span>
            )}
          </div>
        </div>
      </div>

      {/* Add / edit */}
      <form onSubmit={submit} className="mt-6 rounded-3xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4 text-primary" />
          Set or update a category budget
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Monthly limit (KES)"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={saving || !amount}
            className="rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save budget"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Your budgets</h2>
        {loading ? (
          <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
            <Wallet className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No budgets yet — set one above to start tracking limits.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((b) => (
              <BudgetRow key={b.id} b={b} onDelete={() => remove(b.id)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function BudgetRow({ b, onDelete }: { b: BudgetStatus; onDelete: () => void }) {
  const barPct = Math.min(b.pct, 100);
  const StatusIcon =
    b.status === "over" ? AlertTriangle : b.status === "warn" ? AlertCircle : CheckCircle2;
  const statusColor =
    b.status === "over"
      ? "text-destructive"
      : b.status === "warn"
        ? "text-amber-500"
        : "text-emerald-500";
  const barColor =
    b.status === "over"
      ? "bg-destructive"
      : b.status === "warn"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="group rounded-2xl border bg-card p-4 shadow-card transition hover:shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusColor}`} />
          <div className="text-sm font-semibold">{b.category}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <div className="font-bold">
              KES {b.spent.toLocaleString()}{" "}
              <span className="text-muted-foreground font-normal">
                / {b.monthly_limit.toLocaleString()}
              </span>
            </div>
            <div className={`text-xs ${statusColor}`}>
              {b.status === "over"
                ? `Over by KES ${Math.abs(b.remaining).toLocaleString()}`
                : `KES ${b.remaining.toLocaleString()} left · ${b.pct}%`}
            </div>
          </div>
          <button
            onClick={onDelete}
            className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            aria-label="Delete budget"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}
