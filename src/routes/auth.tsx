import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { clearAuthStorage, notifyAuthChanged } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" && search.token ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — DigiCRM AI" },
      { name: "description", content: "Sign in to your DigiCRM AI account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot" | "reset";

// GET /api/v1/auth/my-permissions
type MyPermissions = {
  role: string;
  is_super_admin: boolean;
  permissions: Record<string, string[]>;
  industries: string[]; // subscribed industry keys, e.g. ["real_estate"]
  nav: Record<string, boolean>;
};

// ------------------------------------------------------------
// Industry -> CRM landing route
// ⚠️ Apni real routes ke hisaab se paths badlo.
// Key = backend industry key (Industry.key), value = route jahan us industry ka CRM khulta hai.
// ------------------------------------------------------------
const INDUSTRY_HOME: Record<string, string> = {
  it_company: "/it",
  real_estate: "/realestate",
  coaching: "/coaching",
};
const DEFAULT_HOME = "/dashboard";

function resolveHome(p: MyPermissions | null): string {
  if (!p || p.is_super_admin) return DEFAULT_HOME; // super admin ke paas sab industries hain
  const active = p.industries?.[0];
  return (active && INDUSTRY_HOME[active]) || DEFAULT_HOME;
}

function homeFromStorage(): string {
  try {
    const raw = localStorage.getItem("permissions");
    return resolveHome(raw ? (JSON.parse(raw) as MyPermissions) : null);
  } catch {
    return DEFAULT_HOME;
  }
}

function clearPermissionsStorage() {
  localStorage.removeItem("permissions");
  localStorage.removeItem("active_industry");
}

// Login ke turant baad permissions + industries fetch karke store karo.
// Fail ho to login block nahi hota (null return).
async function loadPermissions(accessToken: string): Promise<MyPermissions | null> {
  try {
    const p = await apiFetch("/api/v1/auth/my-permissions", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    localStorage.setItem("permissions", JSON.stringify(p));

    // Non-super-admin: pehli subscribed industry active hogi
    const active = p.is_super_admin ? null : p.industries?.[0] ?? null;
    if (active) localStorage.setItem("active_industry", active);
    else localStorage.removeItem("active_industry");

    notifyAuthChanged();
    return p as MyPermissions;
  } catch (err) {
    console.error("Failed to load permissions:", err);
    clearPermissionsStorage();
    return null;
  }
}

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

// Response envelope ({ data: {...} }) ho to unwrap karo
function unwrap(raw: any) {
  return raw?.data && !raw?.user && !raw?.tokens && !raw?.temp_token ? raw.data : raw;
}

// Backend AuthResponse: { user, tokens: {access_token, refresh_token, expires_in}, tenant }
// Flat shape ({ access_token, refresh_token, user, tenant }) bhi handle hota hai.
// Returns the access token so caller can use it for follow-up calls.
function saveSession(raw: any): string {
  const data = unwrap(raw);

  const t = data?.tokens ?? data;
  const access = t?.access_token ?? t?.accessToken ?? t?.token;
  const refresh = t?.refresh_token ?? t?.refreshToken;

  if (!access) {
    console.error("Unexpected auth response:", raw);
    throw new Error("Login response did not contain an access token");
  }

  // Purane user ki permissions/industry na bachein
  clearPermissionsStorage();

  localStorage.setItem("access_token", access);
  if (refresh) localStorage.setItem("refresh_token", refresh);
  if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

  if (data.tenant) {
    localStorage.setItem("tenant", JSON.stringify(data.tenant));
  } else {
    localStorage.removeItem("tenant");
  }

  // useAuth() ko same tab mein turant update karo
  notifyAuthChanged();
  return access;
}

function AuthPage() {
  const navigate = useNavigate();
  const { token: resetToken } = Route.useSearch();

  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company_name, setCompany_name] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // First-time login: signin se mila temp_token (sirf memory mein, storage mein nahi)
  const [tempToken, setTempToken] = useState<string | null>(null);
  const isFirstTimeFlow = !!tempToken;

  // Reset token URL mein aaya to mode "reset" rakho
  useEffect(() => {
    if (resetToken) setMode("reset");
  }, [resetToken]);

  // Already logged in hai to us user ki industry ke CRM par bhejo (reset flow ko chhod ke)
  useEffect(() => {
    if (resetToken) return;
    const token = localStorage.getItem("access_token");
    if (token) {
      navigate({ to: homeFromStorage() as any });
    }
  }, [navigate, resetToken]);

  // Session save -> permissions fetch -> industry ke CRM par redirect
  const completeLogin = async (data: any) => {
    const access = saveSession(data);
    const perms = await loadPermissions(access);

    if (!perms) {
      toast.warning("Signed in, but could not load your workspace permissions.");
    } else if (!perms.is_super_admin && perms.industries.length === 0) {
      toast.warning("No active industry is assigned to your workspace yet.");
    }

    navigate({ to: resolveHome(perms) as any });
  };

  // ---------------- LOGIN ----------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const raw = await apiFetch("/api/v1/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = unwrap(raw);

      // First-time login: backend temp_token deta hai, full session nahi
      const tmp = data?.temp_token;
      if (data?.requires_password_change || data?.must_change_password || tmp) {
        if (!tmp) throw new Error("Temporary token missing in response");
        setTempToken(tmp);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setMode("reset");
        toast.info("Please set a new password to continue.");
        return;
      }

      await completeLogin(data);
      toast.success("Welcome back!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- SIGNUP ----------------
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const raw = await apiFetch("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          company_name,
        }),
      });
      const data = unwrap(raw);

      if (data?.tenant) {
        sessionStorage.setItem("signup_tenant", JSON.stringify(data.tenant));
      }

      await completeLogin(data);
      toast.success("Account created successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- FORGOT PASSWORD ----------------
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Backend: MessageResponse -> { message: string }
      const data = await apiFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      toast.success(data?.message ?? "Password reset email sent.");
      setMode("login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- RESET / SET PASSWORD ----------------
  // 1) First-time (temp_token): POST /api/v1/users/me/set-password
  // 2) Forgot-password (email link token): POST /api/v1/auth/reset-password
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Email wale reset link ke liye URL token chahiye; first-time flow mein temp_token
    if (!isFirstTimeFlow && !resetToken) {
      toast.error("Invalid or missing reset token");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      if (isFirstTimeFlow) {
        // Response: "string"
        const data = await apiFetch("/api/v1/users/me/set-password", {
          method: "POST",
          body: JSON.stringify({
            new_password: newPassword,
            temp_token: tempToken,
          }),
        });

        const msg = typeof data === "string" ? data : data?.message;
        toast.success(msg || "Password set successfully. Please sign in with your new password.");
      } else {
        const data = await apiFetch("/api/v1/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            token: resetToken,
            new_password: newPassword,
          }),
        });

        toast.success(data?.message ?? "Password reset successful. Please login again.");
      }

      // Backend ne refresh token revoke kar diya hai, local session bhi saaf karo
      clearAuthStorage();
      clearPermissionsStorage();

      setTempToken(null);
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setMode("login");
      navigate({ to: "/auth", search: {}, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password update failed");
    } finally {
      setLoading(false);
    }
  };

  const score = passwordScore(password);
  const newScore = passwordScore(newPassword);
  const scoreColors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-warning", "bg-success", "bg-success"];
  const scoreLabels = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];

  const titleByMode: Record<Mode, string> = {
    login: "Welcome",
    signup: "Welcome",
    forgot: "Reset your password",
    reset: "Set a new password",
  };

  const descByMode: Record<Mode, string> = {
    login: "Sign in to your account or create a new one.",
    signup: "Sign in to your account or create a new one.",
    forgot: "Enter your email and we'll send you a reset link.",
    reset: "Choose a strong new password for your account.",
  };

  const cardTitle = mode === "reset" && isFirstTimeFlow ? "Set your password" : titleByMode[mode];
  const cardDesc =
    mode === "reset" && isFirstTimeFlow
      ? "This is your first login. Choose a new password to continue."
      : descByMode[mode];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Compact header */}
      <header className="border-b bg-background/80 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-14">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>DigiCRM AI</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden lg:flex relative overflow-hidden gradient-primary text-primary-foreground p-12 flex-col justify-between">
          <div className="flex items-center gap-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            <Sparkles className="h-7 w-7" />
            DigiCRM AI
          </div>
          <div className="relative z-10">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              AI-powered sales, <br />built for enterprise teams.
            </h1>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-lg">
              Close deals faster with intelligent lead scoring, automated follow-ups, and real-time pipeline insights.
            </p>
            <div className="mt-8 flex gap-6 text-sm">
              <div><div className="text-3xl font-bold">98%</div><div className="opacity-80">Lead accuracy</div></div>
              <div><div className="text-3xl font-bold">3.2×</div><div className="opacity-80">Faster close</div></div>
              <div><div className="text-3xl font-bold">24/7</div><div className="opacity-80">AI assistant</div></div>
            </div>
          </div>
          <div className="text-sm opacity-70">© {new Date().getFullYear()} DigiCRM AI</div>
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
          <Card className="w-full max-w-md shadow-elegant border-border/60">
            <CardHeader className="space-y-1">
              <div className="lg:hidden flex items-center gap-2 text-xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>
                <Sparkles className="h-6 w-6 text-primary" /> DigiCRM AI
              </div>
              <CardTitle className="text-2xl">{cardTitle}</CardTitle>
              <CardDescription>{cardDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {mode === "forgot" ? (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>
                    Back to sign in
                  </Button>
                </form>
              ) : mode === "reset" ? (
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newpw">New password</Label>
                    <div className="relative">
                      <Input
                        id="newpw"
                        type={showPw ? "text" : "password"}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`h-1 flex-1 rounded ${i <= newScore ? scoreColors[newScore] : "bg-muted"}`} />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{scoreLabels[newScore]}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmpw">Confirm password</Label>
                    <Input
                      id="confirmpw"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{" "}
                    {isFirstTimeFlow ? "Set password" : "Reset password"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setTempToken(null);
                      setNewPassword("");
                      setConfirmPassword("");
                      setMode("login");
                      navigate({ to: "/auth", search: {}, replace: true });
                    }}
                  >
                    Back to sign in
                  </Button>
                </form>
              ) : (
                <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="login">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4 pt-4">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="pw">Password</Label>
                          <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                            Forgot?
                          </button>
                        </div>
                        <div className="relative">
                          <Input id="pw" type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
                          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4 pt-4">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full name</Label>
                        <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Company name</Label>
                        <Input
                          id="company"
                          required
                          value={company_name}
                          onChange={(e) => setCompany_name(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email2">Email</Label>
                        <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pw2">Password</Label>
                        <Input id="pw2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                        {password && (
                          <div className="space-y-1">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className={`h-1 flex-1 rounded ${i <= score ? scoreColors[score] : "bg-muted"}`} />
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">{scoreLabels[score]}</p>
                          </div>
                        )}
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Compact footer */}
      <footer className="border-t bg-muted/30 py-4">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} DigiCRM AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}