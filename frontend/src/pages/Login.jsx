import React, { useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAdmin } from "../context/AdminContext";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { login } = useAdmin();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(password);
    setBusy(false);
    if (ok) navigate("/");
    else alert("Invalid credentials");
  };

  return (
    <div className="mx-auto max-w-md px-4 md:px-6 lg:px-8 py-16">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold mb-4 heading-serif">Admin Login</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Password
            </label>

            <div className="relative mt-1">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 grid place-items-center text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "…" : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
