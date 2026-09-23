import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
// import { supabase } from "@/integrations/supabase/client";
// import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DigiCRM AI" },
      { name: "description", content: "Sign in to your DigiCRM AI account." },
    ],
  }),
  component: AuthPage,
});

// const DEMO_ACCOUNTS = [
//   { label: "Super Admin", email: "superadmin@digicrm.demo" },
//   { label: "Admin", email: "admin@digicrm.demo" },
//   { label: "Sales Manager", email: "manager@digicrm.demo" },
//   { label: "Sales Executive", email: "executive@digicrm.demo" },
// ]

// const INDUSTRY_DEMOS = [
//   { label: "Financial Services", email: "finserv@digicrm.demo" },
//   { label: "Property", email: "property@digicrm.demo" },
//   { label: "Commerce", email: "commerce@digicrm.demo" },
//   { label: "Mobility & Supply Chain", email: "mobility@digicrm.demo" },
//   { label: "Healthcare", email: "healthcare@digicrm.demo" },
//   { label: "Education", email: "education@digicrm.demo" },
//   { label: "Industrial", email: "industrial@digicrm.demo" },
//   { label: "Professional Services", email: "services@digicrm.demo" },
//   { label: "Client portal", email: "client@digicrm.demo" },
//   { label: "Affiliate partner", email: "partner@digicrm.demo" },
// ];

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company_name, setCompany_name] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // useEffect(() => {
  //   supabase.auth.getSession().then(({ data }) => {
  //     if (data.session) navigate({ to: "/dashboard" });
  //   });
  // }, [navigate]);

  useEffect(() => {
  const token = localStorage.getItem("access_token");

  if (token) {
    navigate({ to: "/dashboard" });
  }
}, [navigate]);

  // const handleLogin = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   const { error } = await supabase.auth.signInWithPassword({ email, password });
  //   setLoading(false);
  //   if (error) return toast.error(error.message);
  //   toast.success("Welcome back!");
  //   navigate({ to: "/dashboard" });
  // };

const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const data = await apiFetch("/api/v1/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    // Save tokens
    localStorage.setItem(
      "access_token",
      data.tokens.access_token
    );

    localStorage.setItem(
      "refresh_token",
      data.tokens.refresh_token
    );

    // Save user information
    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    toast.success("Welcome back!");

    // Redirect after successful login
    navigate({ to: "/dashboard" });

  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Login failed"
    );
  } finally {
    setLoading(false);
  }
};


  // const handleSignup = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   const { error } = await supabase.auth.signUp({
  //     email,
  //     password,
  //     options: {
  //       emailRedirectTo: window.location.origin,
  //       data: { full_name: fullName },
  //     },
  //   });
  //   setLoading(false);
  //   if (error) return toast.error(error.message);
  //   toast.success("Account created! Check your email to verify.");
  //   setMode("login");
  // };

const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const data = await apiFetch("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        full_name: fullName,
        email: email,
        password: password,
        company_name: company_name,
      }),
    });

    // Backend response:
    // data.user
    // data.tokens.access_token
    // data.tokens.refresh_token

    localStorage.setItem(
      "access_token",
      data.tokens.access_token
    );

    localStorage.setItem(
      "refresh_token",
      data.tokens.refresh_token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    if (data.tenant) {
  sessionStorage.setItem(
    "signup_tenant",
    JSON.stringify(data.tenant)
  );}

  navigate({ to: "/dashboard" });
} catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Signup failed"
    );
  } finally {
    setLoading(false);
  }
};

  // const handleForgot = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   const { error } = await supabase.auth.resetPasswordForEmail(email, {
  //     redirectTo: `${window.location.origin}/reset-password`,
  //   });
  //   setLoading(false);
  //   if (error) return toast.error(error.message);
  //   toast.success("Password reset email sent.");
  //   setMode("login");
  // };

const handleForgot = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const message = await apiFetch("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    });

    toast.success(
      typeof message === "string"
        ? message
        : "Password reset email sent."
    );

    setMode("login");
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Password reset failed"
    );
  } finally {
    setLoading(false);
  }
};

//  const handleGoogle = () => {
//   setLoading(true);
//   const redirectUri = `${window.location.origin}/auth/callback`;
//   window.location.href = `/api/auth/google/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
// };

  const score = passwordScore(password);
  const scoreColors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-warning", "bg-success", "bg-success"];
  const scoreLabels = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];

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
          {/* <nav className="flex items-center gap-5 text-sm">
            <Link to="/features" className="text-muted-foreground hover:text-foreground hidden sm:inline">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground hidden sm:inline">Pricing</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
          </nav> */}
        </div>
      </header>
      <div className="flex-1 grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden gradient-primary text-primary-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-2 text-2xl font-bold" style={{fontFamily: "var(--font-display)"}}>
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
            <div className="lg:hidden flex items-center gap-2 text-xl font-bold mb-4" style={{fontFamily: "var(--font-display)"}}>
              <Sparkles className="h-6 w-6 text-primary" /> DigiCRM AI
            </div>
            <CardTitle className="text-2xl">
              {mode === "forgot" ? "Reset your password" : "Welcome"}
            </CardTitle>
            <CardDescription>
              {mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : "Sign in to your account or create a new one."}
            </CardDescription>
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
                            {[1,2,3,4,5].map(i => (
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

            {/* {mode !== "forgot" && (
              <div className="mt-6 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium mb-2">Demo accounts (password: DigiCRM@2025)</p>
                <div className="grid gap-1">
                  {DEMO_ACCOUNTS.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      className="flex items-center justify-between text-xs rounded px-2 py-1 hover:bg-accent transition-colors"
                      onClick={() => { setEmail(d.email); setPassword("DigiCRM@2025"); }}
                    >
                      <span className="font-medium">{d.label}</span>
                      <span className="text-muted-foreground">{d.email}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 mb-2 text-xs font-medium">Industry & client demos</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {INDUSTRY_DEMOS.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      className="rounded px-2 py-1 text-left text-xs transition-colors hover:bg-accent"
                      onClick={() => { setEmail(d.email); setPassword("DigiCRM@2025"); }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )} */}

            {mode !== "forgot" && (
              <>
                {/* <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div> */}
                {/* <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </Button> */}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
      {/* Compact footer */}
      <footer className="border-t bg-muted/30 py-4">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} DigiCRM AI. All rights reserved.</div>
          {/* <div className="flex gap-4">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/blog" className="hover:text-foreground">Blog</Link>
            <Link to="/affiliate" className="hover:text-foreground">Affiliates</Link>
          </div> */}
        </div>
      </footer>
    </div>
  );
}
function login(user: any) {
  throw new Error("Function not implemented.");
}

