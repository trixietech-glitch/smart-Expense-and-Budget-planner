import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Landmark, Trash2, Plus, CreditCard } from "lucide-react";
import { listDebts, upsertDebt, payDebt, deleteDebt, type Debt } from "@/lib/debts.functions";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({ meta: [{ title: "Debts — PesaHub" }] }),
  component: DebtsPage,
});

function DebtsPage() {
  const listFn = useServerFn(listDebts);
  const upsertFn = useServerFn(upsertDebt);
  const payFn = useServerFn(payDebt);
  const deleteFn = useServerFn(deleteDebt);

  const [rows, setRows] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [lender, setLender] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [minPay, setMinPay] = useState("");
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
    const p = Number(principal);
    if (!name.trim() || !isFinite(p) || p < 0) {
      toast.error("Add a name and principal");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          name: name.trim(),
          lender: lender || null,
          principal: p,
          balance: p,
          interest_rate: Number(rate) || 0,
          minimum_payment: Number(minPay) || 0,
          currency: "KES",
          status: "active",
        },
      });
      setName("");
      setLender("");
      setPrincipal("");
      setRate("");
      setMinPay("");
      toast.success("Debt added");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function makePayment(d: Debt) {
    const v = window.prompt(`Pay toward "${d.name}" (KES)`, String(d.minimum_payment || ""));
    if (!v) return;
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return toast.error("Invalid amount");
    try {
      await payFn({ data: { id: d.id, amount: n } });
      toast.success(`Paid KES ${n.toLocaleString()}`);
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

  const totalBalance = rows.reduce((s, d) => s + d.balance, 0);
  const totalMin = rows.filter((d) => d.status === "active").reduce((s, d) => s + d.minimum_payment, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Track what you owe</div>
          <h1 className="text-3xl font-bold tracking-tight">Debts & loans</h1>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">Total balance</div>
          <div className="font-bold">KES {totalBalance.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">
            Min/month: KES {totalMin.toLocaleString()}
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 rounded-3xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4 text-primary" /> New debt
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. KCB loan)"
            className="rounded-xl border bg-background px-4 py-3 text-sm sm:col-span-2 outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={lender}
            onChange={(e) => setLender(e.target.value)}
            placeholder="Lender"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            inputMode="numeric"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Principal"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            inputMode="numeric"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Rate %"
            className="rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <input
            inputMode="numeric"
            value={minPay}
            onChange={(e) => setMinPay(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Min payment / month"
            className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
        <h2 className="mb-3 text-lg font-semibold">Your debts</h2>
        {loading ? (
          <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
            <Landmark className="mx-auto mb-2 h-6 w-6 opacity-50" />
            No debts tracked. Add one to plan repayment.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((d) => {
              const pct = d.principal > 0 ? Math.round(((d.principal - d.balance) / d.principal) * 100) : 0;
              const paid = d.status === "paid";
              return (
                <div key={d.id} className="group rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {d.name}{" "}
                        {paid && (
                          <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            Paid off
                          </span>
                        )}
                      </div>
                      {d.lender && <div className="text-xs text-muted-foreground">{d.lender}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <div className="font-bold">KES {d.balance.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          of {d.principal.toLocaleString()} · {d.interest_rate}%
                        </div>
                      </div>
                      {!paid && (
                        <button
                          onClick={() => makePayment(d)}
                          className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          <CreditCard className="h-3 w-3" /> Pay
                        </button>
                      )}
                      <button
                        onClick={() => remove(d.id)}
                        className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-right text-xs text-muted-foreground">{pct}% repaid</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
