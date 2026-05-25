import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Activity, Lock, Mail, Phone, User as UserIcon, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { login, signup, signupWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone_number: "+91",
    whatsapp_number: "",
    user_type: "Student",
    user_mode: "student",
    selected_category: "Engineering opportunities",
    subscription_plan: "student-basic",
    interests: "",
    keywords: "",
  });

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await login(form.email, form.password);
        if (result) {
          navigate(result.profile?.is_admin ? "/admin" : "/dashboard");
        }
      } else {
        const cleanedForm = {
          name: form.name,
          email: form.email,
          password: form.password,
          phone_number: form.phone_number.replace(/\s+/g, ""),
          whatsapp_number: form.whatsapp_number.replace(/\s+/g, "") || form.phone_number.replace(/\s+/g, ""),
          user_type: form.user_type,
          user_mode: form.user_mode,
          selected_category: form.selected_category,
          subscription_plan: form.subscription_plan,
          interests: form.interests,
          keywords: form.keywords,
        };
        const result = await signup(cleanedForm);
        if (result?.session) {
          navigate("/dashboard");
        } else {
          setError("Signup successful. Please verify your email and sign in to continue.");
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError("");
    setLoading(true);
    try {
      await signupWithGoogle();
    } catch (err) {
      setError(err.message || "Failed to initiate Google authentication");
      console.error("Google auth error:", err);
    }
  }

  return (
    <section className="relative min-h-[calc(100vh-70px)] bg-[#030712] py-16 px-4 sm:px-6 flex items-center justify-center overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-12 items-center z-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 mb-6">
            <Zap size={14} className="text-cyan-400" /> VYNORA PULSE SECURE OAUTH
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Catch the opportunity before the <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">deadline catches you.</span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-300 font-light">
            Sign in to access your Future Impact AI dashboard, connect your Gmail account securely, and setup instant multi-channel alerts.
          </p>

          <div className="mt-8 space-y-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">✓</span>
              <span>Secure read-only Gmail integration</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300">✓</span>
              <span>Bank-grade 256-bit encryption</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300">✓</span>
              <span>1-click instant disconnect anytime</span>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Top accent glow line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />

          <div className="mb-8 grid grid-cols-2 rounded-2xl bg-slate-950 p-1.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                mode === "login"
                  ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                mode === "signup"
                  ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Select Your Primary Role</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "EAMCET Student", type: "EAMCET Student", mode: "student", desc: "Counselling & Predictors" },
                    { label: "Student", type: "Student", mode: "student", desc: "Internships & Hackathons" },
                    { label: "Job Seeker", type: "Job Seeker", mode: "student", desc: "HR Rounds & Placements" },
                    { label: "Professional", type: "Professional", mode: "professional", desc: "Senior Tech & Networking" },
                    { label: "Businessman", type: "Businessman", mode: "professional", desc: "B2B Deals & Coupons" }
                  ].map((role) => (
                    <button
                      type="button"
                      key={role.type}
                      onClick={() => setForm({ ...form, user_type: role.type, user_mode: role.mode })}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        form.user_type === role.type
                          ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-display font-bold text-xs text-white">{role.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 leading-tight">{role.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                  <input
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    name="name"
                    placeholder="Alex Mercer"
                    value={form.name}
                    onChange={updateField}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                <input
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  name="email"
                  type="email"
                  placeholder="alex@university.edu"
                  value={form.email}
                  onChange={updateField}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                <input
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={updateField}
                  required
                />
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                  <input
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                    name="phone_number"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone_number}
                    onChange={updateField}
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 font-mono">Format: +[country code][number]</p>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">WhatsApp Number (Optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                  <input
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                    name="whatsapp_number"
                    type="tel"
                    placeholder="+91 98765 43210 (leave blank to use phone number)"
                    value={form.whatsapp_number}
                    onChange={updateField}
                  />
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">What Type of Alerts Do You Want?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "EAMCET counseling", "JEE updates", "NEET counseling",
                    "Engineering opportunities", "Internships", "Placements",
                    "Government jobs", "Business leads", "Freelancing projects",
                    "Recruiter opportunities",
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setForm({ ...form, selected_category: cat })}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        form.selected_category === cat
                          ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/10"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Professional Interests</label>
                <input
                  name="interests"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 px-4 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="e.g. AI internships, placements, scholarships"
                  value={form.interests}
                  onChange={updateField}
                />
                <p className="mt-1 text-[11px] text-slate-500 font-mono">Phrase your areas of interest so alerts match your intent stronger.</p>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Target Keywords</label>
                <textarea
                  name="keywords"
                  rows={3}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 px-4 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all resize-none"
                  placeholder="e.g. internship, interview, scholarship, coding test"
                  value={form.keywords}
                  onChange={updateField}
                />
                <p className="mt-1 text-[11px] text-slate-500 font-mono">Comma-separated keywords help the system route only the most relevant email alerts to your WhatsApp.</p>
              </div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 py-4 font-bold text-white shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.7)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? <Activity className="animate-spin" size={18} /> : null}
              <span>{mode === "login" ? "Access Dashboard" : "Initialize Operating System"}</span>
            </button>

            {(mode === "signup" || mode === "login") && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500 font-mono">Or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 font-semibold text-white hover:bg-slate-900 hover:border-slate-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </>
            )}
          </form>
        </motion.div>
      </div>
    </section>
  );
}
