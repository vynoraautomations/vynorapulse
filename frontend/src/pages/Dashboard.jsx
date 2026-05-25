import { Activity, AlertTriangle, ArrowRight, Award, Bell, Bot, Briefcase, Calendar, Check, CheckCircle2, Clock, Cpu, ExternalLink, Eye, EyeOff, Filter, Flame, FolderKanban, Inbox, Info, Layers, Link as LinkIcon, MailCheck, MessageSquare, Play, RefreshCcw, Rocket, Search, Send, Settings, ShieldAlert, ShieldCheck, Sparkles, Trash2, TrendingUp, User, Volume2, Zap } from "lucide-react";
import { Lock, Plus, X, LogOut, Camera, CheckCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL, apiRequest } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const { user, refreshUser, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ search: "", category: "", priority: "", tab: "feed" });
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [simulatingSpam, setSimulatingSpam] = useState(false);
  const [showDigestModal, setShowDigestModal] = useState(false);
  const [digests, setDigests] = useState([]);
  const [digestLoading, setDigestLoading] = useState(false);
  const [settingsData, setSettingsData] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState({ status: "disconnected", qr: null, hasSession: false });
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [newGoal, setNewGoal] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone_number: "",
    email: "",
    bio: "",
    interests: "",
    education_details: "",
    avatar_url: "",
    whatsapp_number: "",
    user_type: "",
    user_mode: "",
    selected_category: "",
  });

  async function loadSettings() {
    try {
      const res = await apiRequest("/api/settings");
      setSettingsData(res);
      if (res.profile) {
        setProfileForm({
          name: res.profile.name || "",
          phone_number: res.profile.phone_number || "",
          email: res.profile.email || "",
          bio: res.profile.bio || "",
          interests: res.profile.interests || "",
          education_details: res.profile.education_details || "",
          avatar_url: res.profile.avatar_url || "",
          whatsapp_number: res.profile.whatsapp_number || "",
          user_type: res.profile.user_type || "",
          user_mode: res.profile.user_mode || "",
          selected_category: res.profile.selected_category || "",
        });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  async function loadWhatsappStatus() {
    try {
      const res = await apiRequest("/api/settings/whatsapp-status");
      setWhatsappStatus(res);
    } catch (e) {
      console.error("WhatsApp status load failed:", e);
    }
  }

  async function loadDeliveryHistory() {
    try {
      const res = await apiRequest("/api/settings/delivery-history");
      setDeliveryLogs(res);
    } catch (e) {
      console.error("Delivery logs load failed:", e);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (filters.tab === "settings") {
      loadWhatsappStatus();
      loadDeliveryHistory();
      const interval = setInterval(() => {
        loadWhatsappStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [filters.tab]);

  async function handleAddGoal() {
    if (!newGoal.trim()) return;
    try {
      await apiRequest("/api/settings/goals", {
        method: "POST",
        body: JSON.stringify({ goal: newGoal.trim() })
      });
      setNewGoal("");
      loadSettings();
      setNotice("✨ Custom goal added successfully!");
    } catch (e) {
      setNotice("❌ Failed to add goal: " + e.message);
    }
  }

  async function handleDeleteGoal(goalId) {
    try {
      await apiRequest(`/api/settings/goals/${goalId}`, { method: "DELETE" });
      loadSettings();
      setNotice("Goal removed.");
    } catch (e) {
      setNotice("❌ Failed to delete goal: " + e.message);
    }
  }

  async function handleAddKeyword() {
    if (!newKeyword.trim()) return;
    try {
      await apiRequest("/api/settings/keywords", {
        method: "POST",
        body: JSON.stringify({ keyword: newKeyword.trim() })
      });
      setNewKeyword("");
      loadSettings();
      setNotice("✨ Target keyword added!");
    } catch (e) {
      setNotice("❌ Failed to add keyword: " + e.message);
    }
  }

  async function handleDeleteKeyword(kwId) {
    try {
      await apiRequest(`/api/settings/keywords/${kwId}`, { method: "DELETE" });
      loadSettings();
      setNotice("Keyword removed.");
    } catch (e) {
      setNotice("❌ Failed to delete keyword: " + e.message);
    }
  }

  async function handleSaveProfile() {
    try {
      await apiRequest("/api/settings/profile", {
        method: "PUT",
        body: JSON.stringify(profileForm)
      });
      loadSettings();
      setNotice("✨ Professional profile updated successfully!");
    } catch (e) {
      setNotice("❌ Profile update failed: " + e.message);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    
    setLoading(true);
    try {
      const token = localStorage.getItem("mailalert_token");
      const res = await fetch(`${API_BASE_URL}/api/settings/upload-avatar`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      if (res.ok) {
        loadSettings();
        setNotice("✨ Profile picture updated!");
      } else {
        const err = await res.json();
        setNotice("❌ Upload failed: " + (err.detail || "Unknown error"));
      }
    } catch (err) {
      setNotice("❌ Upload error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleWhatsappLogout() {
    try {
      await apiRequest("/api/settings/whatsapp-logout", { method: "POST" });
      loadWhatsappStatus();
      setNotice("WhatsApp Gateway successfully disconnected.");
    } catch (e) {
      setNotice("❌ Disconnection failed: " + e.message);
    }
  }

  async function handleSendTestWhatsApp() {
    if (!profileForm.whatsapp_number) {
      setNotice("❌ Please enter your WhatsApp number in the profile form first.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/api/settings/whatsapp-test", { method: "POST" });
      setNotice("✨ Test WhatsApp message queued for sending!");
      loadDeliveryHistory();
    } catch (e) {
      setNotice("❌ Test message failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const currentPlanSlug = settingsData?.profile?.plan_slug || "student-basic";
  const hasProAccess = user?.is_admin || ["student-pro", "professional", "business"].includes(currentPlanSlug);
  const hasProfessionalAccess = user?.is_admin || ["professional", "business"].includes(currentPlanSlug);

  const upgradeTargets = {
    radar: {
      recommendedPlanId: "student-pro",
      featureName: "Deadline Radar",
      featureDescription: "Unlock priority alerts, deadline reminders, and opportunity ranking.",
      includedFeatures: ["Instant AI filtering", "Priority alerts", "Deadline reminders", "Opportunity ranking"],
    },
    tracker: {
      recommendedPlanId: "professional",
      featureName: "Application Tracker",
      featureDescription: "Unlock recruiter emails, AI summaries, and interview tracking.",
      includedFeatures: ["Job opportunities", "Recruiter emails", "AI summaries", "Interview tracking"],
    },
  };

  function handleUpgradeClick(targetKey) {
    const target = upgradeTargets[targetKey];
    if (!target) {
      navigate("/subscription");
      return;
    }

    navigate("/subscription", {
      state: {
        recommendedPlanId: target.recommendedPlanId,
        featureName: target.featureName,
        featureDescription: target.featureDescription,
        includedFeatures: target.includedFeatures,
      },
    });
  }

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.search) p.set("search", filters.search);
    if (filters.category) p.set("category", filters.category);
    if (filters.priority) p.set("priority", filters.priority);
    return p.toString();
  }, [filters]);

  async function loadDashboard() {
    try {
      const result = await apiRequest(`/api/dashboard?${query}`);
      setData(result);
      if (result.recent_emails?.some((e) => e.priority === "High" && !e.is_opened)) {
        playHighPrioritySound();
      }
    } catch (err) {
      setNotice(err.message);
    }
  }

  useEffect(() => {
    loadDashboard();
    const id = setInterval(() => loadDashboard(), 20000);
    return () => clearInterval(id);
  }, [query]);

  function playHighPrioritySound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.025;
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 180);
    } catch (e) {
      // Audio context blocked before interaction
    }
  }

  async function action(label, fn) {
    setLoading(true);
    setNotice("");
    try {
      const result = await fn();
      setNotice(result.detail || result.status || `${label} completed`);
      await loadDashboard();
      if (refreshUser) await refreshUser();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setNotice(""), 6000);
    }
  }

  async function connectGmail() {
    if (isLocked) {
      navigate("/subscription");
      return;
    }
    await action("Connecting Gmail", async () => {
      const res = await apiRequest("/api/gmail/connect");
      window.location.href = res.authorization_url || res.authorizationUrl;
      return { detail: "Redirecting to Google OAuth..." };
    });
  }

  async function disconnectGmail() {
    await action("Gmail Disconnected", async () => {
      const res = await apiRequest("/api/gmail/disconnect", { method: "POST" });
      return { detail: "✨ Gmail account successfully disconnected. Future Impact AI polling paused." };
    });
  }

  async function handleOneClickCleanup() {
    if (isLocked) {
      navigate("/subscription");
      return;
    }
    setSimulatingSpam(true);
    try {
      await apiRequest("/api/dashboard/cleanup", { method: "POST" });
      if (refreshUser) await refreshUser();
      setNotice("✨ Smart Spam Shield automatically cleaned promotional shopping & social media distractions!");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSimulatingSpam(false);
      setTimeout(() => setNotice(""), 6000);
    }
  }

  async function toggleUserMode() {
    if (!user) return;
    const nextMode = user.user_mode === "student" ? "professional" : "student";
    await action(`Switched to ${nextMode.toUpperCase()} Mode`, () =>
      apiRequest("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ user_mode: nextMode })
      })
    );
  }

  async function markEmailStatus(id, newStatus) {
    await action(`Updated status to ${newStatus}`, () =>
      apiRequest(`/api/dashboard/emails/${id}/status?status=${encodeURIComponent(newStatus)}`, { method: "PUT" })
    );
  }

  async function openAndRemove(email) {
    window.open(email.gmail_link, "_blank");
    await action("Marked opened", () => apiRequest(`/api/dashboard/emails/${email.id}/open`, { method: "PUT" }));
  }

  async function ignoreEmail(id) {
    await action("Marked distraction", () => apiRequest(`/api/dashboard/emails/${id}/ignore`, { method: "PUT" }));
  }

  async function loadDigests() {
    if (filters.tab !== "digest") return;
    setDigestLoading(true);
    try {
      const d = await apiRequest("/api/digests");
      setDigests(d);
    } catch (_) {}
    finally { setDigestLoading(false); }
  }

  useEffect(() => { loadDigests(); }, [filters.tab]);

  if (!data || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-cyan-400">
          <Activity className="animate-spin" size={36} />
          <p className="font-mono text-sm tracking-widest uppercase animate-pulse">Initializing Vynora Pulse AI Engine...</p>
        </div>
      </div>
    );
  }

  const status = data.status;
  const recentEmails = data.recent_emails || [];
  const isLocked = !user.is_admin && user.approval_status !== "approved";
  
  const activeOpportunities = recentEmails.filter((e) => !e.is_opened && !e.is_ignored);
  const openedOpportunities = recentEmails.filter((e) => e.is_opened);
  const ignoredOpportunities = recentEmails.filter((e) => e.is_ignored);

  const missedOpps = ignoredOpportunities.filter((e) => e.priority === "High" || e.priority === "Critical");

  const careerScore = Math.min(
    999,
    (user.opportunities_tracked || 0) * 15 +
      (user.applications_submitted || 0) * 35 +
      (user.interviews_scheduled || 0) * 75 +
      (user.spam_cleaned_count > 0 ? 50 : 0)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 w-full space-y-8 font-sans text-slate-100">

      {/* Subscription Status Banner */}
      {user.approval_status === "pending" && !user.is_admin && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0"><Zap size={20} /></div>
            <div>
              <p className="font-display font-bold text-white">Activate Your Subscription</p>
              <p className="text-xs text-slate-400 mt-0.5">Select a plan and complete UPI payment to unlock AI email monitoring, WhatsApp alerts, and daily digests.</p>
            </div>
          </div>
          <Link to="/subscription"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:scale-105 transition-all shrink-0 flex items-center gap-2"
          >
            <Zap size={14} /> Choose Plan →
          </Link>
        </motion.div>
      )}

      {user.approval_status === "payment_uploaded" && !user.is_admin && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-center gap-3"
        >
          <Clock size={18} className="text-amber-400 animate-pulse shrink-0" />
          <p className="text-sm text-amber-300 font-medium">
            Payment uploaded ✓ — Awaiting admin manual verification. You will receive a WhatsApp confirmation within 2–4 hours.
          </p>
        </motion.div>
      )}

      {/* Notice & Feedback Bar */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            className="rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-4 text-sm font-medium text-cyan-300 flex items-center justify-between shadow-[0_0_30px_rgba(0,240,255,0.25)] backdrop-blur-xl z-50 relative"
          >
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-cyan-400 animate-spin shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice("")} className="text-xs font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Operating System Hub Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Bot size={14} className="text-cyan-400 animate-pulse" /> Future Impact AI v2.5
              </span>
              <button
                onClick={toggleUserMode}
                className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:text-white hover:bg-purple-500/20 font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 font-semibold"
                title="Click to toggle user mode"
              >
                🔄 {user.user_mode} Mode Active
              </button>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent">{user.name}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400 font-light max-w-2xl leading-relaxed">
              Opportunity Intelligence Engine is live. Real-time scanning for education, internships, placements, and recruiter communications.
            </p>
          </div>

          {/* Integrated Gmail Hub & Control Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            {/* Dedicated Gmail Connect/Disconnect Button & Status */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
              status.gmail_connected
                ? "bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                : "bg-slate-900/80 border-slate-800"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shrink-0 ${status.gmail_connected ? "bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" : "bg-rose-500"}`} />
                <div>
                  <p className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Gmail Status</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">
                    {status.gmail_connected ? status.gmail_email || "Connected Securely" : "Disconnected"}
                  </p>
                </div>
              </div>
              {status.gmail_connected ? (
                <button
                  onClick={disconnectGmail}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold transition-all hover:scale-105 shrink-0"
                >
                  Disconnect Gmail
                </button>
              ) : (
                <button
                  onClick={connectGmail}
                  disabled={loading || isLocked}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-mono text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:shadow-[0_0_25px_rgba(0,240,255,0.7)] hover:scale-105 shrink-0"
                >
                  {isLocked ? "Locked" : "Connect Gmail"}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => isLocked ? navigate("/subscription") : setShowDigestModal(true)}
                className="px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-2"
              >
                <Calendar size={16} className="text-cyan-400" /> Daily Digest
              </button>

              <button
                onClick={handleOneClickCleanup}
                disabled={simulatingSpam || isLocked}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30 border border-rose-500/40 text-xs font-semibold text-rose-300 hover:text-white transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(251,113,133,0.15)] disabled:opacity-50"
              >
                <ShieldAlert size={16} className="text-rose-400 animate-pulse" />
                {simulatingSpam ? "Cleaning..." : "One-Click Cleanup"}
              </button>

              <button
                disabled={loading || isLocked}
                onClick={() => isLocked ? navigate("/subscription") : action("Polling Inbox", () => apiRequest("/api/gmail/poll", { method: "POST" }))}
                className="p-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:scale-105"
                title="Poll Fresh Emails"
              >
                <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* Clean Single-Row Analytics Strip */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award size={14} className="text-yellow-400" /> AI Career Score
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display font-extrabold text-3xl text-white">{careerScore}</span>
              <span className="text-xs font-mono text-yellow-400">/ 1000</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 h-full rounded-full" style={{ width: `${(careerScore / 1000) * 100}%` }} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Inbox size={14} className="text-cyan-400" /> Filtered Opportunities
            </span>
            <div className="mt-2 font-display font-extrabold text-3xl text-cyan-300">
              {user.opportunities_tracked || recentEmails.length}
            </div>
            <span className="text-[11px] text-slate-500 mt-1">High-value placement links</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderKanban size={14} className="text-purple-400" /> Applications Active
            </span>
            <div className="mt-2 font-display font-extrabold text-3xl text-purple-300">
              {user.applications_submitted || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1">Pipeline pending review</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-rose-400" /> Spam Ignored
            </span>
            <div className="mt-2 font-display font-extrabold text-3xl text-rose-300">
              {user.spam_cleaned_count || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1">Social & shopping noise</span>
          </div>
        </div>
      </div>

      {/* Missed opportunity banner */}
      {missedOpps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 sm:p-5 shadow-lg flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-amber-300 flex items-center gap-2">
              Missed Opportunity Detector Alert
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Action Suggested</span>
            </h3>
            <p className="text-sm text-slate-300 font-light mt-1">
              You marked <strong>{missedOpps.length} high-priority</strong> email(s) as ignored recently (e.g. {missedOpps[0]?.company || "Google"}). Make sure you didn't miss a vital placement deadline or coding assessment.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilters({ ...filters, tab: "feed" })}
            className={`px-5 py-3 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2.5 ${
              filters.tab === "feed"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <Bot size={18} className="text-cyan-400 animate-pulse" />
            <span>AI Opportunity Feed</span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
              {activeOpportunities.length}
            </span>
          </button>

          <button
            onClick={() => {
              if (!hasProAccess) {
                handleUpgradeClick("radar");
              } else {
                setFilters({ ...filters, tab: "radar" });
              }
            }}
            className={`px-5 py-3 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2.5 ${
              filters.tab === "radar"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <Clock size={18} className="text-purple-400" />
            <span>Deadline Radar</span>
            {!hasProAccess && <Lock size={12} className="text-amber-400 animate-pulse ml-1" />}
          </button>

          <button
            onClick={() => {
              if (!hasProfessionalAccess) {
                handleUpgradeClick("tracker");
              } else {
                setFilters({ ...filters, tab: "tracker" });
              }
            }}
            className={`px-5 py-3 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2.5 ${
              filters.tab === "tracker"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.25)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <FolderKanban size={18} className="text-pink-400" />
            <span>Application Tracker</span>
            {!hasProfessionalAccess && <Lock size={12} className="text-amber-400 animate-pulse ml-1" />}
          </button>

          <button
            onClick={() => setFilters({ ...filters, tab: "history" })}
            className={`px-5 py-3 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2.5 ${
              filters.tab === "history"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <Bell size={18} className="text-amber-400" />
            <span>Alert Logs</span>
          </button>

          <button
            onClick={() => setFilters({ ...filters, tab: "settings" })}
            className={`px-5 py-3 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2.5 ${
              filters.tab === "settings"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.25)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <Settings size={18} className="text-slate-400" />
            <span>AI Settings</span>
          </button>

          <button
            onClick={() => setFilters({ ...filters, tab: "digest" })}
            className={`px-5 py-3 rounded-2xl font-display font-bold text-sm transition-all flex items-center gap-2.5 ${
              filters.tab === "digest"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <Calendar size={18} className="text-teal-400" />
            <span>Daily Digest</span>
          </button>
        </div>

        {/* Filter bar on the right */}
        {filters.tab === "feed" && (
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
              <input
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 font-medium"
                placeholder="Search company, subject..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <select
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none font-medium cursor-pointer"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All Smart Labels</option>
              {Object.keys(data.categories || {}).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none font-medium cursor-pointer"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <option value="">All Urgency</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Opportunity Feed */}
      {filters.tab === "feed" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-xl text-white flex items-center gap-2">
              <span>Fresh Opportunities Feed</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                (Auto-Removes when opened)
              </span>
            </h2>
            <span className="text-xs font-mono text-cyan-400">Showing {activeOpportunities.length} pending item(s)</span>
          </div>

          {activeOpportunities.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-800 p-16 text-center bg-slate-900/20 backdrop-blur">
              <Bot size={48} className="mx-auto text-cyan-500/40 mb-4 animate-bounce" />
              <h3 className="font-display font-bold text-lg text-white">Your Feed is Clean & Up to Date!</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Future Impact AI has filtered all your emails. We are actively monitoring your Gmail inbox in the background for fresh internship and placement alerts.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {activeOpportunities.map((email) => {
                const relevance = email.relevance_score || 92;
                const urgency = email.urgency || "High";
                const suggestedAction = email.suggested_action || "Review opportunity details";
                const company = email.company || email.sender.split("@")[0].toUpperCase();

                return (
                  <motion.div
                    key={email.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-900/50 p-6 sm:p-8 hover:border-cyan-500/50 transition-all duration-300 shadow-xl group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 px-4 py-1.5 bg-gradient-to-l from-cyan-500/20 to-purple-500/20 rounded-bl-2xl border-l border-b border-cyan-500/30 font-mono text-xs font-bold text-cyan-300 flex items-center gap-1.5 shadow-sm">
                      <Sparkles size={14} className="text-cyan-400" /> AI Relevance {relevance}%
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pt-2">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 text-white font-display font-extrabold text-lg shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                          {company.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <span>🏢 {company}</span>
                            <span>•</span>
                            <span>{email.sender}</span>
                          </p>
                          <h3 className="font-display font-bold text-xl text-white mt-1 group-hover:text-cyan-300 transition-colors">
                            {email.subject}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`px-3 py-1 rounded-xl text-xs font-bold font-mono ${
                          urgency === "Critical" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse" :
                          urgency === "High" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" :
                          "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}>
                          🔥 {urgency} Urgency
                        </span>
                        <span className="px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium">
                          🏷️ {email.category || "Internship"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-4 text-sm leading-relaxed text-slate-300 font-light mb-6">
                      <p className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Bot size={14} /> AI Executive Summary
                      </p>
                      {email.summary}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 shrink-0 font-mono">⚡ Action:</span>
                        <span className="font-semibold text-white">{suggestedAction}</span>
                      </div>
                      <div className="flex items-center sm:justify-end gap-3 font-mono">
                        <span className="text-slate-500">Status:</span>
                        <select
                          value={email.status || "Pending"}
                          onChange={(e) => markEmailStatus(email.id, e.target.value)}
                          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-cyan-400 focus:border-cyan-500 focus:outline-none cursor-pointer"
                        >
                          <option value="Pending">🕒 Pending Review</option>
                          <option value="Applied">🚀 Applied</option>
                          <option value="Interview">🎯 Interview Scheduled</option>
                          <option value="Offer Received">🏆 Offer Received!</option>
                          <option value="Rejected">❌ Rejected</option>
                        </select>
                      </div>
                    </div>

                    {/* Bottom Action bar */}
                    <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openAndRemove(email)}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-xs font-bold text-white shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.7)] hover:scale-105 transition-all flex items-center gap-2"
                        >
                          <ExternalLink size={16} /> Open Gmail & Auto-Remove
                        </button>
                        <button
                          onClick={() => ignoreEmail(email.id)}
                          className="px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-medium transition-all flex items-center gap-1.5"
                        >
                          <EyeOff size={14} /> Mark Distraction / Ignore
                        </button>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        Detected: {new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Opened & Ignored section summary */}
          {(openedOpportunities.length > 0 || ignoredOpportunities.length > 0) && (
            <div className="pt-8 border-t border-slate-800/80">
              <h3 className="font-display font-bold text-base text-slate-400 mb-4 flex items-center justify-between">
                <span>Archived / Opened Opportunities ({openedOpportunities.length + ignoredOpportunities.length})</span>
                <span className="text-xs font-mono text-slate-500">Auto-removed from active queue</span>
              </h3>
              <div className="space-y-3">
                {openedOpportunities.map((e) => (
                  <div key={e.id} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-xs opacity-75 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="font-semibold text-slate-300">{e.sender.split("@")[0]}</span>
                      <span className="text-slate-400 truncate max-w-md">{e.subject}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-emerald-400 font-semibold">✓ Opened</span>
                      <a href={e.gmail_link} target="_blank" rel="noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Gmail ↗</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Deadline Radar */}
      {filters.tab === "radar" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-extrabold text-2xl text-white">Deadline Radar</h2>
              <p className="text-sm text-slate-400 leading-relaxed">Opportunities organized by estimated urgency and last date to apply.</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono text-xs">
              ⚡ Live Radar Tracking
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Critical 24h column */}
            <div className="rounded-3xl border border-rose-500/40 bg-slate-900/60 p-6 space-y-4 shadow-[0_0_25px_rgba(251,113,133,0.1)]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-display font-bold text-rose-400 flex items-center gap-2">
                  <Flame size={18} className="animate-pulse" /> Urgent (Apply within 24h)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-xs font-bold">
                  {recentEmails.filter((e) => e.urgency === "Critical" && !e.is_opened).length}
                </span>
              </div>
              {recentEmails.filter((e) => e.urgency === "Critical" && !e.is_opened).map((email) => (
                <div key={email.id} className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-xs space-y-2 group">
                  <div className="flex justify-between font-bold text-white">
                    <span>{email.company || email.sender.split("@")[0]}</span>
                    <span className="text-rose-400 font-mono">🎯 Match {email.relevance_score || 95}%</span>
                  </div>
                  <p className="text-slate-300 font-semibold">{email.subject}</p>
                  <p className="text-slate-400 font-light leading-relaxed">{email.suggested_action}</p>
                  <div className="pt-2 flex justify-between items-center font-mono">
                    <span className="text-rose-300 font-bold">⚠️ CRITICAL</span>
                    <button onClick={() => openAndRemove(email)} className="text-cyan-400 font-bold hover:underline">Apply Now ↗</button>
                  </div>
                </div>
              ))}
            </div>

            {/* High Priority upcoming */}
            <div className="rounded-3xl border border-amber-500/40 bg-slate-900/60 p-6 space-y-4 shadow-[0_0_25px_rgba(245,158,11,0.1)]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-display font-bold text-amber-400 flex items-center gap-2">
                  <Clock size={18} /> High Priority (This Week)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                  {recentEmails.filter((e) => e.urgency === "High" && !e.is_opened).length}
                </span>
              </div>
              {recentEmails.filter((e) => e.urgency === "High" && !e.is_opened).map((email) => (
                <div key={email.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between font-bold text-white">
                    <span>{email.company || email.sender.split("@")[0]}</span>
                    <span className="text-amber-400 font-mono">🎯 Match {email.relevance_score || 90}%</span>
                  </div>
                  <p className="text-slate-300 font-medium">{email.subject}</p>
                  <p className="text-slate-400 font-light leading-relaxed">{email.suggested_action}</p>
                  <div className="pt-2 flex justify-between items-center font-mono">
                    <span className="text-amber-400">⚡ HIGH URGENCY</span>
                    <button onClick={() => openAndRemove(email)} className="text-cyan-400 font-bold hover:underline">Review ↗</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Medium/Standard */}
            <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-display font-bold text-cyan-400 flex items-center gap-2">
                  <Calendar size={18} /> Upcoming Opportunities
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
                  {recentEmails.filter((e) => e.urgency !== "Critical" && e.urgency !== "High" && !e.is_opened).length}
                </span>
              </div>
              {recentEmails.filter((e) => e.urgency !== "Critical" && e.urgency !== "High" && !e.is_opened).map((email) => (
                <div key={email.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between font-bold text-white">
                    <span>{email.company || email.sender.split("@")[0]}</span>
                    <span className="text-cyan-400 font-mono">🎯 Match {email.relevance_score || 85}%</span>
                  </div>
                  <p className="text-slate-300 font-medium">{email.subject}</p>
                  <div className="pt-2 flex justify-between items-center font-mono">
                    <span className="text-slate-500">Standard</span>
                    <button onClick={() => openAndRemove(email)} className="text-cyan-400 font-bold hover:underline">Open ↗</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Application Tracker */}
      {filters.tab === "tracker" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-extrabold text-2xl text-white">Application Pipeline Tracker</h2>
              <p className="text-sm text-slate-400 leading-relaxed">Manage your application workflow from initial submission to final offer letters.</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold">
              <span>{recentEmails.length} Total Opportunities Tracked</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
            {["Pending", "Applied", "Interview", "Offer Received", "Rejected"].map((colStatus) => {
              const items = recentEmails.filter((e) => (e.status || "Pending") === colStatus);
              const isWin = colStatus === "Offer Received";
              const isInterview = colStatus === "Interview";

              return (
                <div
                  key={colStatus}
                  className={`rounded-3xl border p-4 space-y-4 min-w-[240px] flex flex-col ${
                    isWin ? "bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]" :
                    isInterview ? "bg-purple-950/20 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]" :
                    "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-display font-bold text-sm">
                    <span className={isWin ? "text-emerald-400" : isInterview ? "text-purple-400" : "text-slate-300"}>
                      {colStatus}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1">
                    {items.map((e) => (
                      <div key={e.id} className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs space-y-2 shadow">
                        <div className="flex justify-between font-bold text-white">
                          <span className="truncate max-w-[120px]">{e.company || e.sender.split("@")[0]}</span>
                          <span className="text-cyan-400 font-mono">🎯 {e.relevance_score || 95}%</span>
                        </div>
                        <p className="text-slate-400 line-clamp-2 font-light leading-relaxed">{e.subject}</p>
                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between font-mono">
                          <select
                            value={e.status || "Pending"}
                            onChange={(ev) => markEmailStatus(e.id, ev.target.value)}
                            className="bg-transparent text-[11px] text-slate-400 hover:text-white cursor-pointer focus:outline-none"
                          >
                            <option value="Pending">Move to: Pending</option>
                            <option value="Applied">Move to: Applied</option>
                            <option value="Interview">Move to: Interview</option>
                            <option value="Offer Received">Move to: Offer Received</option>
                            <option value="Rejected">Move to: Rejected</option>
                          </select>
                          <a href={e.gmail_link} target="_blank" rel="noreferrer" className="text-cyan-400 font-bold hover:underline">↗</a>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-600 font-mono border border-dashed border-slate-800 rounded-2xl">
                        No items in {colStatus}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Alert Logs History */}
      {filters.tab === "history" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-extrabold text-2xl text-white">Real-Time Alert History</h2>
              <p className="text-sm text-slate-400 leading-relaxed">Log of WhatsApp and Telegram alerts broadcasted by Future Impact AI.</p>
            </div>
            <button
              onClick={() => action("Cleared logs", () => apiRequest("/api/dashboard/history", { method: "DELETE" }))}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105"
            >
              <Trash2 size={16} /> Clear Logs
            </button>
          </div>

          <div className="space-y-3">
            {(!data.notifications || data.notifications.length === 0) && (
              <div className="rounded-3xl border border-dashed border-slate-800 p-16 text-center bg-slate-900/20">
                <Bell size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No alerts recorded yet.</p>
              </div>
            )}
            {data.notifications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs uppercase font-bold">
                      {item.channel}
                    </span>
                    <span className={`text-xs font-bold ${item.status === "sent" ? "text-emerald-400" : "text-rose-400"}`}>
                      ● {item.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <pre className="mt-3 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {item.message}
                  </pre>
                  {item.error_message && <p className="text-xs text-rose-400 font-mono mt-2">Error: {item.error_message}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Premium AI Settings & Integrations */}
      {filters.tab === "settings" && (
        <div className="space-y-8">
          <div>
            <h2 className="font-display font-extrabold text-2xl text-white">AI Personalization & Gateway Center</h2>
            <p className="text-sm text-slate-400 mt-1">Refine your AI intelligence filters, connect devices, and view multi-channel delivery diagnostics.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Personal Profile Details Form */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-md p-6 sm:p-8 space-y-6 shadow-xl">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <User size={18} className="text-cyan-400" /> Personal Career Profile
                </h3>

                {/* Profile Picture Widget */}
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group w-24 h-24 rounded-full overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center cursor-pointer shadow-md">
                    {settingsData?.profile?.avatar_url ? (
                      <img 
                        src={settingsData.profile.avatar_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={36} className="text-slate-500" />
                    )}
                    <label className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera size={18} className="text-cyan-400 animate-bounce" />
                      <span className="text-[10px] font-mono text-slate-400 mt-1">Upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleAvatarChange} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Custom System Avatar</h4>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-sm leading-relaxed">
                      Upload an image file (.png, .jpg, .webp). Max size 2MB. Your avatar updates across all future digests.
                    </p>
                  </div>
                </div>

                {/* Profile Form inputs */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Display Name</label>
                    <input
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Phone Number</label>
                    <input
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                      placeholder="e.g. +919876543210"
                      value={profileForm.phone_number}
                      onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">WhatsApp Alert Phone</label>
                    <input
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                      placeholder="e.g. +919876543210"
                      value={profileForm.whatsapp_number}
                      onChange={(e) => setProfileForm({ ...profileForm, whatsapp_number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Education Details</label>
                    <textarea
                      className="w-full h-20 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-cyan-500 focus:outline-none leading-relaxed"
                      placeholder="e.g. B.Tech in CSE, MCA, AI specialization"
                      value={profileForm.education_details}
                      onChange={(e) => setProfileForm({ ...profileForm, education_details: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Career Category / Focus</label>
                    <select
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none cursor-pointer"
                      value={profileForm.user_type}
                      onChange={(e) => setProfileForm({ ...profileForm, user_type: e.target.value })}
                    >
                      <option value="Engineering Students">Engineering Student</option>
                      <option value="Medical Professionals">Medical Professional</option>
                      <option value="Business Management">Business Management</option>
                      <option value="Arts and Sciences">Arts and Sciences</option>
                      <option value="General Professional">General Professional</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Operating Mode</label>
                    <select
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none cursor-pointer"
                      value={profileForm.user_mode}
                      onChange={(e) => setProfileForm({ ...profileForm, user_mode: e.target.value })}
                    >
                      <option value="student">🎓 Student Mode</option>
                      <option value="professional">💼 Professional Mode</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Brief Bio / Technical Focus</label>
                    <textarea
                      className="w-full h-20 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-cyan-500 focus:outline-none leading-relaxed font-sans"
                      placeholder="e.g. Seeking Full Stack Internships and Open Source Contributions..."
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Personal Interests (comma-separated)</label>
                    <input
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g. React, Artificial Intelligence, Cybersecurity, Placement Updates"
                      value={profileForm.interests}
                      onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-xs font-bold text-white shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:scale-105 transition-all"
                  >
                    Save Profile Changes
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Custom Goals & Keywords list */}
            <div className="lg:col-span-5 space-y-6">
              {/* Goals Setup */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-md p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Award size={16} className="text-purple-400" /> My Custom Career Goals
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-light">
                  Define high-priority goals. The AI will strictly prioritize alerts that match these milestones.
                </p>

                {/* Tags grid */}
                <div className="flex flex-wrap gap-2 py-2">
                  {settingsData?.goals?.length === 0 && (
                    <span className="text-xs font-mono text-slate-500 italic">No custom goals set.</span>
                  )}
                  {settingsData?.goals?.map((g) => (
                    <span key={g.id} className="px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium flex items-center gap-1.5 animate-fade-in">
                      <span>🎯 {g.goal}</span>
                      <button onClick={() => handleDeleteGoal(g.id)} className="hover:text-rose-400 text-slate-500 transition-colors">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Input */}
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none"
                    placeholder="Add goal, e.g. AWS Certification"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGoal()}
                  />
                  <button onClick={handleAddGoal} className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500 hover:text-white transition-all shadow-md shrink-0">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Keywords Setup — WhatsApp Alert Triggers */}
              <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-slate-900/40 backdrop-blur-md p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Zap size={16} className="text-emerald-400 animate-pulse" /> WhatsApp Alert Keywords
                  </h3>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                    {settingsData?.keywords?.length || 0} Active
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 flex items-start gap-2">
                  <MessageSquare size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    <span className="font-bold">How it works:</span> When any email in your Gmail contains these keywords in the subject, sender, or body — Vynora AI <span className="text-white font-bold">instantly sends a WhatsApp alert</span> to your registered number. No AI quota needed.
                  </p>
                </div>

                {/* Quick-add suggestion chips */}
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Quick Add Common Keywords:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["internship", "shortlisted", "offer letter", "interview", "selected", "OA link", "hackathon", "placement", "EAMCET", "scholarship", "deadline", "congratulations", "hiring"].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => { setNewKeyword(chip); }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-mono hover:border-emerald-500/50 hover:text-emerald-300 hover:bg-emerald-950/30 transition-all"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Keywords Tags */}
                <div className="flex flex-wrap gap-2 py-1 min-h-[36px]">
                  {settingsData?.keywords?.length === 0 && (
                    <span className="text-xs font-mono text-slate-500 italic">No keywords set — add some above to start receiving WhatsApp alerts!</span>
                  )}
                  {settingsData?.keywords?.map((k) => (
                    <span key={k.id} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-1.5 shadow-sm">
                      <Zap size={10} className="text-emerald-400" />
                      <span>{k.keyword}</span>
                      <button onClick={() => handleDeleteKeyword(k.id)} className="hover:text-rose-400 text-slate-500 transition-colors ml-0.5">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Input */}
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                    placeholder="Type a keyword and press Enter or click +"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                  />
                  <button onClick={handleAddKeyword} className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-white transition-all shadow-md font-bold text-xs flex items-center gap-1.5 shrink-0">
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
          </div>


          {/* Single admin WhatsApp Web gateway widget */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 shrink-0">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Admin WhatsApp Web Gateway</h3>
                  <p className="text-xs text-slate-400 mt-0.5">One business/admin WhatsApp session powers all user alerts. Users only save their WhatsApp number.</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col sm:flex-row items-center gap-3 self-start sm:self-auto">
                {whatsappStatus.status === "ready" && (
                  <button
                    onClick={handleSendTestWhatsApp}
                    disabled={loading}
                    className="px-4 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500 hover:text-white transition-all font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send size={14} /> Send Test Alert
                  </button>
                )}
                {whatsappStatus.status === "ready" ? (
                  <>
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                      WHATSAPP WEB READY
                    </span>
                    <button
                      onClick={handleWhatsappLogout}
                      className="px-4 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500 hover:text-white transition-all font-bold text-xs flex items-center gap-1.5"
                    >
                      <LogOut size={14} /> Disconnect
                    </button>
                  </>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    {whatsappStatus.status === "qr_ready" ? "QR READY" : "DISCONNECTED"}
                  </span>
                )}
              </div>
            </div>

            {/* Cloud Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {whatsappStatus.status === "ready" ? (
                <div className="md:col-span-12 p-6 rounded-2xl bg-emerald-950/25 border border-emerald-500/20 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={20} />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Vynora WhatsApp Gateway Connected</h4>
                      <p className="text-xs text-slate-300 leading-relaxed font-light">
                        The admin WhatsApp account is authenticated through whatsapp-web.js. Vynora Pulse can now deliver Gmail summaries and admin broadcasts to registered user numbers.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono text-slate-400">
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-900">
                      <div className="text-slate-500 font-mono text-[9px] uppercase font-bold tracking-wider">Gateway Model</div>
                      <div className="text-xs font-semibold text-cyan-400 mt-1">whatsapp-web.js</div>
                    </div>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-900">
                      <div className="text-slate-500 font-mono text-[9px] uppercase font-bold tracking-wider">Webhook State</div>
                      <div className="text-xs font-semibold text-emerald-400 mt-1">Listening (Port 8000)</div>
                    </div>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-900">
                      <div className="text-slate-500 font-mono text-[9px] uppercase font-bold tracking-wider">Retry Pipeline</div>
                      <div className="text-xs font-semibold text-purple-400 mt-1">Active (Exponential)</div>
                    </div>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-900">
                      <div className="text-slate-500 font-mono text-[9px] uppercase font-bold tracking-wider">Delivery Mode</div>
                      <div className="text-xs font-semibold text-white mt-1">Real-Time Broadcast</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-12 p-6 rounded-2xl bg-rose-950/20 border border-rose-500/20 space-y-3">
                  <h4 className="text-sm font-bold text-white">WhatsApp Gateway Needs Admin Scan</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ask the platform admin to open the WhatsApp connection panel and scan the QR once. User accounts never scan QR codes.
                  </p>
                  {whatsappStatus.qrCode && <img src={whatsappStatus.qrCode} alt="WhatsApp QR" className="mt-4 h-48 w-48 rounded-2xl border border-slate-700 bg-white p-3" />}
                </div>
              )}
            </div>
          </div>

          {/* Delivery Logs History Table */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-md p-6 sm:p-8 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Inbox size={18} className="text-purple-400" /> Direct Messaging Delivery History
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-light">
              Real-time monitoring of delivery pipelines, including queued events, retries, and failure diagnostics.
            </p>

            <div className="overflow-x-auto w-full pt-2">
              {deliveryLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-600 font-mono italic">
                  No delivery logs recorded yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-mono uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Log ID</th>
                      <th className="pb-3 font-semibold">Recipient</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Retries</th>
                      <th className="pb-3 font-semibold">Sent At</th>
                      <th className="pb-3 font-semibold">Error Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-800/40 hover:bg-slate-900/20 transition-colors font-sans">
                        <td className="py-3 font-mono text-slate-500">#{log.id}</td>
                        <td className="py-3 text-slate-200 font-medium">{log.recipient}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono uppercase ${
                            log.status === "sent" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                            log.status === "retrying" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                            log.status === "failed" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-slate-400">{log.retry_count}</td>
                        <td className="py-3 text-slate-400">
                          {new Date(log.sent_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="py-3 text-rose-400 font-mono max-w-[200px] truncate" title={log.error_message}>
                          {log.error_message || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Daily Digest */}
      {filters.tab === "digest" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-display font-extrabold text-2xl text-white flex items-center gap-2">
                <Calendar size={24} className="text-teal-400" /> Personalized Daily Digests
              </h2>
              <p className="text-sm text-slate-400 mt-1">AI-generated opportunity briefings based on your category: <span className="text-cyan-300 font-mono font-bold">{user.selected_category || "Engineering opportunities"}</span></p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  try {
                    await apiRequest("/api/digests/generate?send_whatsapp=false", { method: "POST" });
                    setNotice("✅ New digest generated successfully!");
                    loadDigests();
                  } catch (err) { setNotice("⚠️ " + err.message); }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xs font-bold shadow-[0_0_15px_rgba(0,200,200,0.3)] hover:scale-105 transition-all flex items-center gap-2"
              >
                <Sparkles size={14} /> Generate Today's Digest
              </button>
              <button
                onClick={async () => {
                  try {
                    await apiRequest("/api/digests/generate?send_whatsapp=true", { method: "POST" });
                    setNotice("📱 Digest generated & sent to WhatsApp!");
                    loadDigests();
                  } catch (err) { setNotice("⚠️ " + err.message); }
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-2"
              >
                <MessageSquare size={14} className="text-green-400" /> Send to WhatsApp
              </button>
            </div>
          </div>

          {digestLoading && (
            <div className="flex items-center justify-center py-12">
              <Activity size={28} className="animate-spin text-teal-400" />
            </div>
          )}

          {!digestLoading && digests.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-800 p-16 text-center bg-slate-900/20">
              <Calendar size={48} className="mx-auto text-teal-500/40 mb-4" />
              <h3 className="font-display font-bold text-lg text-white">No Digests Yet</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">Click "Generate Today's Digest" to get your personalized AI career briefing based on your Gmail emails.</p>
            </div>
          )}

          <div className="space-y-5">
            {digests.map((digest) => (
              <motion.div
                key={digest.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-teal-500/5 to-cyan-500/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="font-display font-bold text-white text-sm">{digest.category}</p>
                      <p className="text-xs text-slate-400 font-mono">{digest.digest_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {digest.is_sent_whatsapp && (
                      <span className="px-2.5 py-1 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-mono">📱 Sent to WhatsApp</span>
                    )}
                    <span className="text-xs text-slate-500 font-mono">{new Date(digest.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
                <pre className="px-6 py-5 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-transparent">{digest.content}</pre>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Digest Modal */}
      <AnimatePresence>
        {showDigestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-3xl border border-cyan-500/40 bg-slate-900 p-8 shadow-2xl max-w-xl w-full space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-xl text-white">Daily Opportunity Digest</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Generated by Future Impact AI • {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <button onClick={() => setShowDigestModal(false)} className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-mono text-slate-400 hover:text-white">Close</button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-sm leading-relaxed text-slate-300 font-light">
                <p className="font-bold text-white flex items-center gap-2 text-cyan-300">
                  <Sparkles size={16} /> Good Morning, {user.name}! Here is your career briefing:
                </p>
                <p>
                  ⚡ Future Impact AI scanned <strong>{recentEmails.length + (user.spam_cleaned_count || 0)} emails</strong> over the last 24 hours. We successfully blocked <strong>{user.spam_cleaned_count || 0} promotional shopping & social media distractions</strong>.
                </p>
                <p className="text-rose-300 font-medium">
                  🔥 You have <strong>{recentEmails.filter((e) => e.urgency === "Critical" && !e.is_opened).length} critical deadlines</strong> requiring immediate attention today.
                </p>
                <p className="text-purple-300 font-medium">
                  🎯 Your highest relevance opportunity is <strong>{recentEmails[0]?.subject || "Software Engineering Assessment"}</strong> at 98% match.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDigestModal(false)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 hover:scale-105 transition-all"
                >
                  Focus on My Opportunities
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
