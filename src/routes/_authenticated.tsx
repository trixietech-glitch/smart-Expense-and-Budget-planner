import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, BarChart3, LogOut, Wallet, Target, Landmark, Repeat, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
      else setEmail(session.user.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else {
        setEmail(data.session.user.email ?? null);
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-soft text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-hero text-primary-foreground">P</span>
            PesaHub
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto rounded-full border bg-card p-1 text-sm">
            <NavTab to="/dashboard" current={path} icon={LayoutDashboard} label="Dashboard" />
            <NavTab to="/budgets" current={path} icon={Wallet} label="Budgets" />
            <NavTab to="/goals" current={path} icon={Target} label="Goals" />
            <NavTab to="/debts" current={path} icon={Landmark} label="Debts" />
            <NavTab to="/subscriptions" current={path} icon={Repeat} label="Subs" />
            <NavTab to="/insights" current={path} icon={Sparkles} label="Insights" />
            <NavTab to="/analytics" current={path} icon={BarChart3} label="Analytics" />
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:block">{email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="grid h-9 w-9 place-items-center rounded-full border bg-card text-muted-foreground hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function NavTab({
  to,
  current,
  icon: Icon,
  label,
}: {
  to: "/dashboard" | "/analytics" | "/budgets" | "/goals" | "/debts" | "/subscriptions" | "/insights";
  current: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const active = current === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
        active ? "bg-gradient-hero text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
