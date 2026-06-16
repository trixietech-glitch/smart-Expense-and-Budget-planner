import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Repeat, Trash2, Plus, Power } from "lucide-react";
import {
  listSubscriptions,
  upsertSubscription,
  toggleSubscription,
  deleteSubscription,
  type Subscription,
} from "@/lib/subscriptions.functions";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — PesaHub" }] }),
  component: SubsPage,
});

const CYCLES = ["weekly", "monthly", "quarterly", "yearly"] as const;
const CYCLE_TO_MONTHS: Record<(typeof CYCLES)[number], number> = {
  weekly: 1 / 4.33,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

function SubsPage() {
  const listFn = useServerFn(listSubscriptions);
  const upsertFn = useServerFn(upsertSubscription);
  const toggleFn = useServerFn(toggleSubscription);
  const deleteFn = useServerFn(deleteSubscription);

  const [rows, setRows] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>("monthly");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows(await listFn());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
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
    if (!name.trim() || !isFinite(n) || n < 0) return toast.error("Add a name and amount");
    setSaving(true);
    try {
      await upsertFn({
        data: {
          name: name.trim(),
          amount: n,
          currency: "KES",
          billing_cycle: cycle,
          next_renewal: next || null,
          active: true,
        },
      });
      setName("");
      setAmount("");
      setNext("");
      toast.success("Subscription added");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(s: Subscription) {
    try {
      await toggleFn({ data: { id: s.id, active: !s.active } });
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
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const monthlyCost = useMemo(
    () =>
      rows
        .filter((s) => s.active)
        .reduce((sum, s) => sum + s.amount / CYCLE_TO_MONTHS[s.billing_cycle as keyof typeof CYCLE_TO_MONTHS], 0),
    [rows],
  );

  const today = new Date();
  const soon = (d: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - today.getTime()) / 86_400_000;
    return diff >= 0 && diff <= 7;
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Recurring spending</div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">Effective monthly</div>
          <div className="font-bold">KES {Math.round(monthlyCost).toLocaleString()}</div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 rounded-3xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4 text-primary" /> New subscription
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_140px_160px_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Netflix, Showmax"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Amount"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as (typeof CYCLES)[number])}
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {CYCLES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Active & paused</h2>
        {loading ? (
          <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
            <Repeat className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No subscriptions tracked.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((s) => (
              <div
                key={s.id}
                className={`group rounded-2xl border bg-card p-4 shadow-card ${
                  s.active ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {s.name}{" "}
                      {soon(s.next_renewal) && s.active && (
                        <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                          Renews soon
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.billing_cycle}
                      {s.next_renewal && ` · next ${new Date(s.next_renewal).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm font-bold">
                      KES {s.amount.toLocaleString()}
                    </div>
                    <button
                      onClick={() => toggle(s)}
                      className="grid h-8 w-8 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
                      aria-label="Toggle"
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
