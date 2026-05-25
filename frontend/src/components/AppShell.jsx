import { Activity, Cpu, LogOut, Moon, Shield, Sun, User as UserIcon, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppShell() {
  const { session, user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("mailalert_theme");
    return saved !== null ? saved === "dark" : true; // Default to dark mode for futuristic feel
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("mailalert_theme", dark ? "dark" : "light");
  }, [dark]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const isAdmin = profile?.is_admin || profile?.role === "admin";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white flex flex-col transition-colors duration-300">
      {/* Top subtle glow bar */}
      <div className="h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(0,240,255,0.8)]" />

      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 text-white shadow-[0_0_20px_rgba(0,240,255,0.4)] group-hover:shadow-[0_0_30px_rgba(0,240,255,0.8)] transition-all duration-300">
              <Activity className="animate-pulse" size={22} />
              <div className="absolute inset-0 rounded-xl bg-cyan-400 opacity-0 group-hover:opacity-20 blur transition-opacity duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
                VYNORA PULSE
              </span>
              <span className="text-[10px] uppercase font-mono font-semibold tracking-widest text-cyan-400 -mt-1 flex items-center gap-1">
                by Vynora Automations <Zap size={8} className="inline text-pink-500 fill-pink-500 animate-bounce" />
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            {session && profile && (
              <div className="hidden md:flex items-center gap-2 mr-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-medium">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  profile.approval_status === "approved" ? "bg-emerald-400 animate-pulse" :
                  profile.approval_status === "payment_uploaded" ? "bg-amber-400 animate-pulse" :
                  "bg-slate-500"
                }`} />
                <span className="text-slate-300 capitalize">{profile.user_mode} Mode :</span>
                <span className="text-cyan-400 font-semibold">{profile.user_type}</span>
              </div>
            )}

            {/* Subscription status badge */}
            {session && profile && !isAdmin && (
              <Link
                to="/subscription"
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold border transition-all ${
                  profile.approval_status === "approved"
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60"
                    : profile.approval_status === "payment_uploaded"
                    ? "bg-amber-950/40 border-amber-500/40 text-amber-300 animate-pulse"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {profile.approval_status === "approved" ? "✓ Active" :
                 profile.approval_status === "payment_uploaded" ? "⏳ Pending" : "⚡ Subscribe"}
              </Link>
            )}

            {session && (
              <Link
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  location.pathname === "/dashboard"
                    ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    : "hover:bg-slate-900 text-slate-300 hover:text-white border border-transparent"
                }`}
                to="/dashboard"
              >
                <Cpu size={16} className="text-cyan-400" /> Dashboard
              </Link>
            )}

            {session && (
              <Link
                className={`hidden sm:flex rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 items-center gap-2 ${
                  location.pathname === "/profile"
                    ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/50 text-emerald-300"
                    : "hover:bg-slate-900 text-slate-400 hover:text-emerald-300 border border-transparent"
                }`}
                to="/profile"
              >
                <UserIcon size={16} /> Profile
              </Link>
            )}

            {/* Admin link — only for admin users */}
            {session && isAdmin && (
              <Link
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  location.pathname === "/admin"
                    ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 text-purple-300"
                    : "hover:bg-slate-900 text-slate-400 hover:text-purple-300 border border-transparent"
                }`}
                to="/admin"
              >
                <Shield size={16} /> Admin
              </Link>
            )}

            <button
              className="focus-ring rounded-xl p-2.5 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition-all duration-200"
              onClick={() => setDark((value) => !value)}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {session ? (
              <button
                className="focus-ring rounded-xl p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition-all duration-200"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            ) : (
              <Link
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.8)] hover:scale-105 transition-all duration-200"
                to="/login"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Vynora Pulse. All rights reserved. "Never Miss What Changes Your Future."</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Opportunity Intelligence</span>
            <span>•</span>
            <span>Career Operating System</span>
            <span>•</span>
            <span className="text-cyan-400">Future Impact AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
