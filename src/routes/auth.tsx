import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Apple, Chrome, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to PesaHub" },
      {
        name: "description",
        content: "Sign in or create your PesaHub account to start tracking expenses with AI.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const type = params.get("type");

    if (type === "recovery" || code) {
      setIsRecoveryMode(true);
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
          if (error) {
            toast.error("This recovery link is invalid or has expired. Please request a new one.");
            return;
          }
          if (data.session) {
            toast.success("Recovery link accepted. You can now set a new password.");
          }
        });
      }
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to PesaHub.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Please enter your email first so we can send recovery instructions.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Recovery instructions sent to your email.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to send recovery email";
      toast.error(msg);
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(provider: "google" | "apple") {
    setSocialLoading(provider);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Social sign-in failed";
      toast.error(msg);
    } finally {
      setSocialLoading(null);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-hero p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-foreground/15 backdrop-blur">
            P
          </span>
          PesaHub
        </Link>
        <div>
          <div className="text-4xl font-bold leading-tight">
            "I finally understand where my money goes — without spreadsheets."
          </div>
          <div className="mt-4 text-primary-foreground/80">— Sarah W., Nairobi</div>
        </div>
        <div className="text-xs text-primary-foreground/60">Panga. Track. Save. Grow.</div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            {isRecoveryMode ? "Reset your password" : mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRecoveryMode
              ? "Choose a new password to regain access to your account."
              : mode === "signin"
                ? "Sign in to keep tracking your spending."
                : "Start tracking in under a minute."}
          </p>

          {isRecoveryMode ? (
            <form onSubmit={handlePasswordReset} className="mt-8 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 pr-12 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-hero py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
              >
                {loading ? <Loader2 className="mx-auto animate-spin" size={18} /> : "Update password"}
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Brian"
                    className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 pr-12 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === "signin" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-muted-foreground/40"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="font-medium text-primary hover:underline"
                  >
                    {recoveryLoading ? "Sending…" : "Forgot password?"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-hero py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
              >
                {loading ? <Loader2 className="mx-auto animate-spin" size={18} /> : mode === "signin" ? "Sign in" : "Create account"}
              </button>

              {mode === "signin" && !resetSent && (
                <div className="space-y-3 pt-2">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleSocialLogin("google")}
                      disabled={socialLoading !== null}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
                    >
                      {socialLoading === "google" ? <Loader2 className="animate-spin" size={16} /> : <Chrome size={16} />}
                      Google
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSocialLogin("apple")}
                      disabled={socialLoading !== null}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
                    >
                      {socialLoading === "apple" ? <Loader2 className="animate-spin" size={16} /> : <Apple size={16} />}
                      Apple
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button
                  onClick={() => {
                    setMode("signup");
                    setIsRecoveryMode(false);
                    setResetSent(false);
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("signin");
                    setIsRecoveryMode(false);
                    setResetSent(false);
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
