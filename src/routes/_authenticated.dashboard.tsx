import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  logFromText,
  logFromSms,
  logFromSmsBatch,
  logFromReceipt,
  createManual,
  deleteTransaction,
  getHealthScore,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/transactions.functions";
import {
  Sparkles,
  Send,
  Wallet,
  TrendingUp,
  Receipt,
  Trash2,
  MessageSquareText,
  Camera,
  Pencil,
  Heart,
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PesaHub" }] }),
  component: Dashboard,
});

type Tx = {
  id: string;
  type: "expense" | "income" | "savings" | "loan" | "transfer";
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  description: string | null;
  raw_text: string | null;
  source: string;
  spent_at: string;
};

type Tab = "ai" | "sms" | "receipt" | "manual";

const TYPE_META: Record<Tx["type"], { label: string; color: string; sign: "+" | "-" | ""; icon: typeof ArrowDownRight }> = {
  expense: { label: "Expense", color: "oklch(0.65 0.18 30)", sign: "-", icon: ArrowDownRight },
  income: { label: "Income", color: "oklch(0.58 0.16 152)", sign: "+", icon: ArrowUpRight },
  savings: { label: "Savings", color: "oklch(0.6 0.15 260)", sign: "", icon: PiggyBank },
  loan: { label: "Loan", color: "oklch(0.7 0.15 320)", sign: "", icon: Landmark },
  transfer: { label: "Transfer", color: "oklch(0.6 0.02 160)", sign: "", icon: ArrowUpRight },
};

function Dashboard() {
  const router = useRouter();
  const logTextFn = useServerFn(logFromText);
  const logSmsFn = useServerFn(logFromSms);
  const logSmsBatchFn = useServerFn(logFromSmsBatch);
  const logReceiptFn = useServerFn(logFromReceipt);
  const createManualFn = useServerFn(createManual);
  const deleteFn = useServerFn(deleteTransaction);
  const healthFn = useServerFn(getHealthScore);

  const [rows, setRows] = useState<Tx[]>([]);
  const [name, setName] = useState<string>("there");
  const [tab, setTab] = useState<Tab>("ai");
  const [health, setHealth] = useState<Awaited<ReturnType<typeof getHealthScore>> | null>(null);

  async function load() {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .order("spent_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as unknown as Tx[]);
  }

  async function loadHealth() {
    try {
      const h = await healthFn();
      setHealth(h);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    loadHealth();
    supabase.auth.getUser().then(({ data }) => {
      const dn = (data.user?.user_metadata as { display_name?: string } | null)?.display_name;
      if (dn) setName(dn);
      else if (data.user?.email) setName(data.user.email.split("@")[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function afterLog() {
    await load();
    loadHealth();
    router.invalidate();
  }

  async function remove(id: string) {
    try {
      await deleteFn({ data: { id } });
      setRows((e) => e.filter((x) => x.id !== id));
      loadHealth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = rows.filter((e) => new Date(e.spent_at) >= monthStart);
  const monthExpense = thisMonth.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const monthIncome = thisMonth.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const todayExpense = rows
    .filter((e) => e.type === "expense" && new Date(e.spent_at).toDateString() === now.toDateString())
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Good {greet()},</div>
          <h1 className="text-3xl font-bold tracking-tight capitalize">{name} 👋</h1>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Spent this month" value={fmt(monthExpense)} icon={Wallet} highlight />
        <StatCard label="Income this month" value={fmt(monthIncome)} icon={TrendingUp} />
        <StatCard label="Today" value={fmt(todayExpense)} icon={Receipt} />
        <HealthCard health={health} />
      </div>

      {/* Logger */}
      <div className="mt-8 rounded-3xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-sm">
          <TabBtn active={tab === "ai"} onClick={() => setTab("ai")} icon={Sparkles} label="AI Text" />
          <TabBtn active={tab === "sms"} onClick={() => setTab("sms")} icon={MessageSquareText} label="Paste SMS" />
          <TabBtn active={tab === "receipt"} onClick={() => setTab("receipt")} icon={Camera} label="Scan Receipt" />
          <TabBtn active={tab === "manual"} onClick={() => setTab("manual")} icon={Pencil} label="Manual" />
        </div>
        <div className="mt-5">
          {tab === "ai" && <AiTextPanel logFn={logTextFn} onDone={afterLog} />}
          {tab === "sms" && <SmsPanel logFn={logSmsFn} onDone={afterLog} />}
          {tab === "receipt" && <ReceiptPanel logFn={logReceiptFn} onDone={afterLog} />}
          {tab === "manual" && <ManualPanel logFn={createManualFn} onDone={afterLog} />}
        </div>
      </div>

      {/* Feed */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent transactions</h2>
          <span className="text-xs text-muted-foreground">{rows.length} total</span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Nothing logged yet — try any of the tabs above.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((e) => {
              const meta = TYPE_META[e.type] ?? TYPE_META.expense;
              const Icon = meta.icon;
              return (
                <div
                  key={e.id}
                  className="group flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-card transition hover:shadow-glow"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
                      style={{ backgroundColor: meta.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{e.description || e.merchant || e.raw_text || meta.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {meta.label} · {e.category} · {srcLabel(e.source)} ·{" "}
                        {new Date(e.spent_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold">
                      {meta.sign}
                      {e.currency} {Number(e.amount).toLocaleString()}
                    </div>
                    <button
                      onClick={() => remove(e.id)}
                      className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* -------------------- Panels -------------------- */

function AiTextPanel({
  logFn,
  onDone,
}: {
  logFn: (a: { data: { text: string } }) => Promise<unknown>;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const examples = [
    "Spent 450 KES on lunch at the cafe",
    "Matatu fare 120",
    "Got salary 45000",
    "Saved 5000 to MMF",
  ];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await logFn({ data: { text: text.trim() } });
      setText("");
      toast.success("Logged");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  }
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        Type what happened — AI figures out the rest
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Spent 450 KES on lunch"
          className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex items-center gap-2 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {sending ? "Logging…" : "Log"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function SmsPanel({
  logFn,
  onDone,
}: {
  logFn: (a: { data: { sms: string } }) => Promise<unknown>;
  onDone: () => void;
}) {
  const [sms, setSms] = useState("");
  const [sending, setSending] = useState(false);
  const examples = [
    "TGH4X5Y2 Confirmed. Ksh450.00 paid to UBER KENYA on 11/6/26 at 1:24 PM. New M-PESA balance is Ksh3,210.55.",
    "Your A/C XXXX1234 has been debited KES 5,000.00 on 11-Jun-26 via card payment at NAIVAS WESTLANDS. Avail bal KES 12,330.00. KCB",
    "Salary credit of KES 45,000.00 received in A/C XXXX9876 on 30-May-26. Equity Bank.",
  ];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sms.trim() || sending) return;
    setSending(true);
    try {
      await logFn({ data: { sms: sms.trim() } });
      setSms("");
      toast.success("SMS parsed and logged");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't parse SMS");
    } finally {
      setSending(false);
    }
  }
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquareText className="h-4 w-4 text-primary" />
        Paste an M-Pesa or bank SMS — AI detects amount, merchant, and category
      </div>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <textarea
          value={sms}
          onChange={(e) => setSms(e.target.value)}
          placeholder="Paste the full SMS here…"
          rows={4}
          className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          disabled={sending}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !sms.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {sending ? "Parsing…" : "Parse & log"}
          </button>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((ex, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSms(ex)}
            className="max-w-full truncate rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            title={ex}
          >
            Example {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReceiptPanel({
  logFn,
  onDone,
}: {
  logFn: (a: { data: { imageDataUrl: string } }) => Promise<unknown>;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onFile(file: File) {
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Image is over 6MB — please use a smaller photo");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setPreview(dataUrl);
  }

  async function submit() {
    if (!preview || sending) return;
    setSending(true);
    try {
      await logFn({ data: { imageDataUrl: preview } });
      toast.success("Receipt logged");
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read receipt");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Camera className="h-4 w-4 text-primary" />
        Snap a receipt — AI extracts amount, merchant, and category
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_220px]">
        <div>
          <label className="flex h-40 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-background text-sm text-muted-foreground hover:bg-accent">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            {preview ? "Choose a different photo" : "Tap to upload or take a photo"}
          </label>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!preview || sending}
              className="flex items-center gap-2 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {sending ? "Reading…" : "Read receipt"}
            </button>
          </div>
        </div>
        {preview ? (
          <img src={preview} alt="receipt preview" className="h-40 w-full rounded-xl border object-contain bg-background" />
        ) : (
          <div className="grid h-40 place-items-center rounded-xl border bg-background/40 text-xs text-muted-foreground">
            Preview
          </div>
        )}
      </div>
    </div>
  );
}

function ManualPanel({
  logFn,
  onDone,
}: {
  logFn: (a: {
    data: {
      type: "expense" | "income" | "savings" | "loan" | "transfer";
      amount: number;
      category: string;
      merchant?: string;
      description?: string;
      spent_at?: string;
      currency?: string;
    };
  }) => Promise<unknown>;
  onDone: () => void;
}) {
  const [type, setType] = useState<"expense" | "income" | "savings" | "loan">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [sending, setSending] = useState(false);

  const cats = useMemo<readonly string[]>(() => {
    if (type === "income") return INCOME_CATEGORIES;
    if (type === "savings") return ["Savings"];
    if (type === "loan") return ["Loan"];
    return EXPENSE_CATEGORIES;
  }, [type]);

  useEffect(() => {
    setCategory(cats[0]);
  }, [cats]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    setSending(true);
    try {
      await logFn({
        data: {
          type,
          amount: amt,
          category,
          merchant,
          description,
          spent_at: new Date(date).toISOString(),
        },
      });
      toast.success("Logged");
      setAmount("");
      setMerchant("");
      setDescription("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  const TYPES: Array<{ id: typeof type; label: string }> = [
    { id: "expense", label: "Expense" },
    { id: "income", label: "Income" },
    { id: "savings", label: "Savings" },
    { id: "loan", label: "Loan" },
  ];

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setType(t.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium ${
              type === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (KES)">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Merchant / source (optional)">
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder={type === "income" ? "Employer name" : "Where you spent"}
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Note (optional)" className="sm:col-span-2">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. May rent"
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={sending}
          className="flex items-center gap-2 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {sending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/* -------------------- Atoms -------------------- */

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
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
      className={`rounded-3xl border p-5 shadow-card ${
        highlight ? "bg-gradient-hero text-primary-foreground" : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`text-xs ${highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</div>
        <Icon className={`h-4 w-4 ${highlight ? "text-primary-foreground/80" : "text-primary"}`} />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function HealthCard({ health }: { health: Awaited<ReturnType<typeof getHealthScore>> | null }) {
  const score = health?.score ?? null;
  const ring = score ?? 0;
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Financial health</div>
        <Heart className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="relative grid h-14 w-14 place-items-center rounded-full"
          style={{
            background: `conic-gradient(oklch(0.58 0.16 152) ${ring * 3.6}deg, oklch(0.92 0.015 150) 0)`,
          }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-full bg-card text-sm font-bold">
            {score ?? "—"}
          </div>
        </div>
        <div className="text-xs text-muted-foreground leading-snug">
          {health?.tip ?? "Log a few transactions to compute your score."}
        </div>
      </div>
    </div>
  );
}

/* -------------------- helpers -------------------- */

function fmt(v: number) {
  return `KES ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function greet() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
function srcLabel(s: string) {
  if (s === "ai_text") return "AI";
  if (s === "sms") return "SMS";
  if (s === "receipt") return "Receipt";
  return "Manual";
}
