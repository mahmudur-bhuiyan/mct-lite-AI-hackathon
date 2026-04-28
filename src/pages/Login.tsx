import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Brain, Shield, Briefcase, User as UserIcon } from "lucide-react";

type DemoRole = "admin" | "loan_officer" | "user";

const DEMO_ACCOUNTS: { role: DemoRole; label: string; email: string; password: string; route: string; icon: any }[] = [
  { role: "admin",        label: "Admin",        email: "admin@demo.co", password: "DemoAdmin!2026", route: "/admin",     icon: Shield },
  { role: "loan_officer", label: "Loan Officer", email: "lo@demo.co",    password: "DemoLO!2026",    route: "/dashboard", icon: Briefcase },
  { role: "user",         label: "User",         email: "user@demo.co",  password: "DemoU!2026",     route: "/knowledge", icon: UserIcon },
];

function routeForRole(role: string | undefined): string {
  if (role === "admin" || role === "moderator") return "/admin";
  if (role === "loan_officer") return "/dashboard";
  return "/knowledge";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const resolveRoleAndNavigate = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    let target = "/dashboard";
    if (uid) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();
      target = routeForRole(roleRow?.role as string | undefined);
    }
    navigate(target, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      await resolveRoleAndNavigate();
    } catch (error: any) {
      setError(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Google sign in error:", error);
      setError(error.message || "Failed to sign in with Google");
      setLoading(false);
    }
  };

  const fillDemo = (acct: typeof DEMO_ACCOUNTS[number]) => {
    setEmail(acct.email);
    setPassword(acct.password);
    setError("");
  };

  const loginAsDemo = async (acct: typeof DEMO_ACCOUNTS[number]) => {
    setEmail(acct.email);
    setPassword(acct.password);
    setError("");
    setLoading(true);
    try {
      await signIn(acct.email, acct.password);
      navigate(acct.route, { replace: true });
    } catch (error: any) {
      setError(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Brain className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">MCT Lite</h1>
        </div>

        <Card className="shadow-premium">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              
              {/* Demo Credentials */}
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Demo Credentials</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Admin:</span>
                    <button
                      type="button"
                      onClick={() => { setEmail("admin@mortgagecontroltower.com"); setPassword("Admin@123"); }}
                      className="font-mono text-foreground hover:text-primary"
                    >
                      admin@mortgagecontroltower.com
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Loan Officer:</span>
                    <button
                      type="button"
                      onClick={() => { setEmail("loanofficer@mortgagecontroltower.com"); setPassword("LoanOfficer@123"); }}
                      className="font-mono text-foreground hover:text-primary"
                    >
                      loanofficer@mortgagecontroltower.com
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">User:</span>
                    <button
                      type="button"
                      onClick={() => { setEmail("demo@mortgagecontroltower.com"); setPassword("Demo@123"); }}
                      className="font-mono text-foreground hover:text-primary"
                    >
                      demo@mortgagecontroltower.com
                    </button>
                  </div>
                  <p className="mt-1 text-muted-foreground/70">Click email to auto-fill credentials</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Link 
                    to="/forgot-password" 
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10"
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col space-y-4 pt-2">
              <Button type="submit" className="h-10 w-full font-medium" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full font-medium"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security.
        </p>
      </div>
    </div>
  );
}
