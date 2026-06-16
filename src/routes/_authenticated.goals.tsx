import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Target, Trash2, Plus, TrendingUp } from "lucide-react";
import {
  listGoals,
  upsertGoal,
  contributeGoal,
  deleteGoal,
  type Goal,
} from "@/lib/goals.functions";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Savings Goals — PesaHub" }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const listFn = useServerFn(listGoals);
  const upsertFn = useServerFn(upsertGoal);
  const contribFn = useServerFn(contributeGoal);
  const deleteFn = useServerFn(deleteGoal);

  const [rows, setRows] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows(await listFn());
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
    const t = Number(target);
    if (!name.trim() || !isFinite(t) || t <= 0) {
      toast.error("Add a name and a valid target");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          name: name.trim(),
          target_amount: t,
          current_amount: 0,
          currency: "KES",
          target_date: date || null,
        },
      });
      setName("");
      setTarget("");
      setDate("");
      toast.success("Goal added");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function addContribution(g: Goal) {
    const v = window.prompt(`Add to "${g.name}" (KES)`);
    if (!v) return;
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return toast.error("Invalid amount");
    try {
      await contribFn({ data: { id: g.id, amount: n } });
      toast.success(`+ KES ${n.toLocaleString()}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
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

  const totalTarget = rows.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved = rows.reduce((s, g) => s + g.current_amount, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Save with purpose</div>
          <h1 className="text-3xl font-bold tracking-tight">Savings goals</h1>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">Saved / target</div>
          <div className="font-bold">
            KES {totalSaved.toLocaleString()} / {totalTarget.toLocaleString()}
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 rounded-3xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4 text-primary" />
          New goal
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_160px_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency fund"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Target (KES)"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add goal"}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Your goals</h2>
        {loading ? (
          <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
            <Target className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No goals yet — set one above to start saving with intention.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((g) => {
              const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
              return (
                <div key={g.id} className="group rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      {g.target_date && (
                        <div className="text-xs text-muted-foreground">
                          by {new Date(g.target_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => remove(g.id)}
                      className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      aria-label="Delete goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gradient-hero transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-bold">KES {g.current_amount.toLocaleString()}</span>
                      <span className="text-muted-foreground"> / {g.target_amount.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => addContribution(g)}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                    >
                      <TrendingUp className="h-3 w-3" /> Contribute
                    </button>
                  </div>
                  <div className="mt-1 text-right text-xs text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
