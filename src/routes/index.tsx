import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Wallet, TrendingUp, Zap, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PesaHub — Track every shilling with AI" },
      {
        name: "description",
        content:
          "Type what you spent in plain English. PesaHub turns your daily expenses into a budget, report and savings plan automatically.",
      },
      { property: "og:title", content: "PesaHub — Track every shilling with AI" },
      {
        property: "og:description",
        content: "Smart, simple, secure personal finance built for Kenya.",
      },
    ],
  }),
  component: Landing,
});

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-hero text-primary-foreground font-bold shadow-glow">
        P
      </div>
      <div className="leading-tight">
        <div className="font-bold tracking-tight">PesaHub</div>
        <div className="text-[10px] text-muted-foreground -mt-0.5">Panga. Track. Save. Grow.</div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#trust" className="hover:text-foreground">
            Privacy
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pt-10 pb-24 lg:grid-cols-2 lg:pt-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI-powered expense tracking
            </div>
            <h1 className="mt-5 text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Just type it.{" "}
              <span className="bg-gradient-hero bg-clip-text text-transparent">
                We'll handle the rest.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Tell PesaHub what you spent in plain English — "
              <em>Spent 450 KES on lunch at the cafe</em>" — and we'll categorize, store and
              visualise it instantly. Smart. Simple. Secure.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="rounded-full bg-gradient-hero px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
              >
                Start tracking free
              </Link>
              <a
                href="#how"
                className="rounded-full border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent"
              >
                See how it works
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Bank-level security
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-primary" /> Instant insights
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-primary" /> Built for Kenya
              </span>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-hero opacity-20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] border-8 border-foreground/90 bg-card shadow-glow">
              <div className="flex items-center justify-between px-6 pt-4 text-[11px] text-foreground/70">
                <span>9:41</span>
                <span>● ● ●</span>
              </div>
              <div className="p-5">
                <div className="text-xs text-muted-foreground">Good morning,</div>
                <div className="text-lg font-semibold">Brian 👋</div>

                <div className="mt-4 rounded-2xl bg-gradient-hero p-5 text-primary-foreground shadow-card">
                  <div className="text-xs opacity-80">This month</div>
                  <div className="mt-1 text-3xl font-bold">KES 28,450</div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary-foreground/20">
                    <div className="h-full w-[63%] rounded-full bg-primary-foreground/90" />
                  </div>
                  <div className="mt-2 text-xs opacity-80">63% of monthly budget</div>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    { t: "Lunch at Java", a: "450", c: "Food & Drink" },
                    { t: "Matatu to town", a: "120", c: "Transport" },
                    { t: "Naivas groceries", a: "2,300", c: "Groceries" },
                  ].map((r) => (
                    <div
                      key={r.t}
                      className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2.5"
                    >
                      <div>
                        <div className="text-sm font-medium">{r.t}</div>
                        <div className="text-[10px] text-muted-foreground">{r.c}</div>
                      </div>
                      <div className="text-sm font-semibold text-foreground">- KES {r.a}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-3">
                  <MessageSquareText className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Spent 450 KES on lunch…</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="border-y bg-card/50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to master your money
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              One natural sentence in. A full picture of your finances out.
            </p>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  i: MessageSquareText,
                  t: "Natural language logging",
                  d: 'Type "Bought airtime 200" — done. No forms, no menus.',
                },
                {
                  i: Sparkles,
                  t: "AI categorization",
                  d: "Gemini reads your text and files it under the right category every time.",
                },
                {
                  i: TrendingUp,
                  t: "Live spending insights",
                  d: "See where your money goes with charts that update as you type.",
                },
                {
                  i: Wallet,
                  t: "Budget tracking",
                  d: "Set monthly goals per category and watch your progress in real time.",
                },
                {
                  i: ShieldCheck,
                  t: "Private by default",
                  d: "Your data is encrypted and only ever visible to you.",
                },
                {
                  i: Zap,
                  t: "Built for Kenya",
                  d: "Defaults to KES, understands matatu, mama mboga and M-Pesa lingo.",
                },
              ].map((f) => (
                <div
                  key={f.t}
                  className="rounded-2xl border bg-background p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary">
                    <f.i className="h-5 w-5" />
                  </div>
                  <div className="mt-4 font-semibold">{f.t}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-3xl font-bold tracking-tight">Three steps to a clearer wallet</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                n: "01",
                t: "Type what you spent",
                d: '"Spent 450 KES on lunch and soda at the cafe."',
              },
              {
                n: "02",
                t: "AI parses & files it",
                d: "Amount, category and description extracted automatically.",
              },
              {
                n: "03",
                t: "Watch your story unfold",
                d: "Your dashboard and analytics update instantly.",
              },
            ].map((s) => (
              <div key={s.n} className="rounded-3xl border bg-card p-8 shadow-card">
                <div className="text-sm font-bold tracking-widest text-primary">{s.n}</div>
                <div className="mt-3 text-xl font-semibold">{s.t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="trust" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="overflow-hidden rounded-3xl bg-gradient-hero p-10 text-primary-foreground shadow-glow sm:p-16">
            <div className="max-w-2xl">
              <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Start your financial freedom today.
              </h3>
              <p className="mt-3 text-primary-foreground/80">
                Free to use. Takes 30 seconds to set up. Your future self will thank you.
              </p>
              <Link
                to="/auth"
                className="mt-6 inline-block rounded-full bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-background/90"
              >
                Create your free account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <div>© {new Date().getFullYear()} PesaHub. Built for Kenya, by Kenyans.</div>
        </div>
      </footer>
    </div>
  );
}
