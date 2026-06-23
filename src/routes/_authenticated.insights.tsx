import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";
import { getAiInsights } from "@/lib/insights.functions";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

type InsightsData = Awaited<ReturnType<typeof getAiInsights>>;

const SEVERITY: Record<
  string,
  { icon: typeof Info; bg: string; ring: string; text: string; label: string }
> = {
  good: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    ring: "ring-emerald-200 dark:ring-emerald-900",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Win",
  },
  info: {
    icon: Info,
    bg: "bg-sky-50 dark:bg-sky-950/40",
    ring: "ring-sky-200 dark:ring-sky-900",
    text: "text-sky-700 dark:text-sky-300",
    label: "Info",
  },
  warn: {
    icon: AlertTriangle,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    ring: "ring-amber-200 dark:ring-amber-900",
    text: "text-amber-700 dark:text-amber-300",
    label: "Heads up",
  },
  alert: {
    icon: AlertTriangle,
    bg: "bg-red-50 dark:bg-red-950/40",
    ring: "ring-red-200 dark:ring-red-900",
    text: "text-red-700 dark:text-red-300",
    label: "Action needed",
  },
};

function fmt(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function InsightsPage() {
  const fetcher = useServerFn(getAiInsights);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }

  const load = useCallback(loadData, [fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  const s = data?.summary;
  const deltaUp = (s?.expenseDeltaPct ?? 0) >= 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" /> AI Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Personalised recommendations from your last 30 days.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {s && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Income (30d)" value={fmt(s.income30)} />
          <StatCard
            label="Expenses (30d)"
            value={fmt(s.expense30)}
            hint={
              s.expenseDeltaPct == null
                ? undefined
                : `${deltaUp ? "+" : ""}${s.expenseDeltaPct}% vs prev 30d`
            }
            hintIcon={s.expenseDeltaPct == null ? undefined : deltaUp ? TrendingUp : TrendingDown}
            hintColor={
              s.expenseDeltaPct == null ? undefined : deltaUp ? "text-red-600" : "text-emerald-600"
            }
          />
          <StatCard label="Savings rate" value={`${s.savingsRate}%`} hint={fmt(s.savings30)} />
          <StatCard
            label="Subscriptions / mo"
            value={fmt(s.monthlySubscriptions)}
            hint={`Debt: ${fmt(s.totalDebt)}`}
          />
        </div>
      )}

      <section className="grid gap-3 lg:grid-cols-2">
        {loading && !data && (
          <>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </>
        )}
        {data?.insights.map((ins, i) => {
          const cfg = SEVERITY[ins.severity] ?? SEVERITY.info;
          const Icon = cfg.icon;
          return (
            <article key={i} className={`rounded-xl ring-1 ${cfg.ring} ${cfg.bg} p-4 shadow-sm`}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full bg-background/80 ${cfg.text}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>
                  {cfg.label}
                </span>
                {ins.category && (
                  <span className="ml-auto rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                    {ins.category}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold">{ins.title}</h3>
              <p className="mt-1 text-sm text-foreground/80">{ins.body}</p>
              {ins.action && (
                <p className="mt-2 text-xs font-medium text-foreground/70">→ {ins.action}</p>
              )}
            </article>
          );
        })}
      </section>

      {s && s.budgetStatus.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Budget status</h2>
          <div className="space-y-2 rounded-xl border bg-card p-4">
            {s.budgetStatus.map((b) => {
              const color =
                b.pct >= 100 ? "bg-red-500" : b.pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={b.category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{b.category}</span>
                    <span className="text-muted-foreground">
                      {fmt(b.spent)} / {fmt(b.limit)} · {b.pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${color}`}
                      style={{ width: `${Math.min(100, b.pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {s && s.categoryDeltas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Biggest category changes</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {s.categoryDeltas.map((c) => {
              const up = c.pctChange >= 0;
              return (
                <div
                  key={c.category}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div>
                    <p className="font-medium">{c.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(c.current)} vs {fmt(c.previous)}
                    </p>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-sm font-semibold ${up ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {up ? "+" : ""}
                    {c.pctChange}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  hintIcon: Icon,
  hintColor,
}: {
  label: string;
  value: string;
  hint?: string;
  hintIcon?: typeof Info;
  hintColor?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs ${hintColor ?? "text-muted-foreground"}`}
        >
          {Icon && <Icon className="h-3 w-3" />}
          {hint}
        </p>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="h-32 animate-pulse rounded-xl border bg-muted/30" />;
}
