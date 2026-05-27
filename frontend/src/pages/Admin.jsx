import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { API_BASE_URL, apiRequest } from "../services/api.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Users, CheckCircle2, XCircle, AlertTriangle, Ban,
  Bell, BarChart3, Mail, Zap, RefreshCcw, Activity, Send,
  Eye, ChevronDown, Search, Bot, MessageSquare, Clock, IndianRupee, Trash2
} from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700" },
  payment_uploaded: { label: "Payment Uploaded", color: "text-amber-300", bg: "bg-amber-950/30", border: "border-amber-500/40" },
  approved: { label: "Approved", color: "text-emerald-300", bg: "bg-emerald-950/30", border: "border-emerald-500/40" },
  rejected: { label: "Rejected", color: "text-rose-300", bg: "bg-rose-950/30", border: "border-rose-500/40" },
  suspended: { label: "Suspended", color: "text-orange-300", bg: "bg-orange-950/30", border: "border-orange-500/40" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [tab, setTab] = useState("users");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeMsg, setNoticeMsg] = useState({});
  const [expandedUser, setExpandedUser] = useState(null);

  const isAdmin = user?.is_admin || user?.email === "vynoraautomations@gmail.com";

  useEffect(() => {
    if (!isAdmin) { navigate("/dashboard"); return; }
    fetchAll();
  }, [isAdmin]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const [u, s, l, sec, wa] = await Promise.all([
        apiRequest(`/api/admin/users?${params}`),
        apiRequest("/api/admin/stats"),
        apiRequest("/api/admin/logs"),
        apiRequest("/api/admin/security-logs"),
        apiRequest("/api/admin/whatsapp/status"),
      ]);
      setUsers(u);
      setStats(s);
      setLogs(l);
      setSecurityLogs(sec);
      setWhatsappStatus(wa);
    } catch (err) {
      showNotice("⚠️ " + err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { fetchAll(); }, [statusFilter]);

  useEffect(() => {
    const refreshWhatsappStatus = async () => {
      try {
        const wa = await apiRequest("/api/admin/whatsapp/status");
        setWhatsappStatus(wa);
      } catch {
        // Ignore transient polling errors so the admin page stays usable.
      }
    };

    refreshWhatsappStatus();
    const intervalId = window.setInterval(refreshWhatsappStatus, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 5000);
  }

  async function adminAction(endpoint, successMsg, method = "POST") {
    try {
      const res = await apiRequest(endpoint, { method });
      showNotice(res.detail || successMsg);
      await fetchAll();
    } catch (err) {
      showNotice("⚠️ " + err.message);
    }
  }

  async function sendNotice(userId) {
    const msg = noticeMsg[userId];
    if (!msg?.trim()) return;
    if (!isWhatsappConnected) {
      showNotice("⚠️ Connect WhatsApp first before sending notifications.");
      return;
    }
    try {
      await apiRequest(`/api/admin/users/${userId}/notify`, {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      showNotice("✅ WhatsApp notification broadcasted.");
      setNoticeMsg({ ...noticeMsg, [userId]: "" });
    } catch (err) {
      showNotice("⚠️ " + err.message);
    }
  }

  async function connectWhatsApp() {
    try {
      if (isWhatsappConnected) {
        showNotice("✅ WhatsApp is already connected.");
        return;
      }
      setQrLoading(true);
      const res = await apiRequest("/api/whatsapp/connect", { method: "POST" });
      setWhatsappStatus(res);
      setShowQRModal(true);
      showNotice("📱 Scan the QR code with WhatsApp on your phone to connect.");
      // Poll for connection status every 3 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiRequest("/api/whatsapp/connection-status", { method: "GET" });
          if (statusRes.connected) {
            setWhatsappStatus(statusRes);
            setShowQRModal(false);
            showNotice("✅ WhatsApp connected successfully!");
            clearInterval(pollInterval);
            await fetchAll();
          }
        } catch (err) {
          // Continue polling
        }
      }, 3000);
      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);
    } catch (err) {
      showNotice("⚠️ " + err.message);
    } finally {
      setQrLoading(false);
    }
  }

  async function disconnectWhatsApp() {
    if (!window.confirm("Are you sure you want to disconnect WhatsApp? This will stop all alerts temporarily.")) {
      return;
    }
    try {
      const res = await apiRequest("/api/whatsapp/disconnect", { method: "POST" });
      setWhatsappStatus(res);
      setShowQRModal(false);
      showNotice("🔌 WhatsApp disconnected successfully.");
      await fetchAll();
    } catch (err) {
      showNotice("⚠️ " + err.message);
    }
  }

  const statCards = stats ? [
    { label: "Total Users", value: stats.total_users, icon: Users, color: "text-cyan-400", glow: "from-cyan-500/10" },
    { label: "Pending Verifications", value: stats.pending_verifications, icon: Clock, color: "text-amber-400", glow: "from-amber-500/10" },
    { label: "Active Subs", value: stats.active_subscriptions, icon: CheckCircle2, color: "text-emerald-400", glow: "from-emerald-500/10" },
    { label: "Revenue", value: `₹${stats.revenue_inr || 0}`, icon: IndianRupee, color: "text-lime-400", glow: "from-lime-500/10" },
    { label: "Gmail Connected", value: stats.active_gmail, icon: Mail, color: "text-purple-400", glow: "from-purple-500/10" },
    { label: "Emails Processed", value: stats.total_emails_processed, icon: Bot, color: "text-emerald-400", glow: "from-emerald-500/10" },
    { label: "Alerts Sent", value: stats.total_notifications_sent, icon: MessageSquare, color: "text-pink-400", glow: "from-pink-500/10" },
    { label: "WhatsApp Sent", value: stats.total_whatsapp_sent, icon: Send, color: "text-emerald-400", glow: "from-emerald-500/10" },
    { label: "WhatsApp Failed", value: stats.total_whatsapp_failed, icon: AlertTriangle, color: "text-rose-400", glow: "from-rose-500/10" },
  ] : [];
  const isWhatsappConnected = Boolean(
    whatsappStatus && (
      whatsappStatus.connected === true ||
      whatsappStatus.ready === true ||
      whatsappStatus.status === "connected"
    )
  );

  if (!isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 space-y-8 font-sans text-slate-100">
      {/* Notice bar */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-4 text-sm font-medium text-cyan-300 flex items-center justify-between shadow-[0_0_20px_rgba(0,240,255,0.2)]"
          >
            <span className="flex items-center gap-2"><Zap size={16} className="text-cyan-400" />{notice}</span>
            <button onClick={() => setNotice("")} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Shield size={12} /> Admin Control Center
              </span>
            </div>
            <h1 className="font-display text-3xl font-extrabold text-white">Vynora Pulse Admin</h1>
            <p className="mt-1 text-sm text-slate-400">Logged in as: <span className="text-purple-300 font-mono">{user?.email}</span></p>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-2"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className={`p-4 rounded-2xl bg-gradient-to-b ${s.glow} to-transparent border border-slate-800/80`}>
                <div className="flex items-center gap-2 mb-2">
                  <s.icon size={16} className={s.color} />
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{s.label}</span>
                </div>
                <div className={`font-display font-extrabold text-2xl ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {whatsappStatus && (
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">WhatsApp Gateway</p>
                <h2 className="text-lg font-semibold text-white">Admin WhatsApp Connection</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isWhatsappConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                  {isWhatsappConnected ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-200">
                <Zap size={14} /> {whatsappStatus.status || 'unknown'}
              </span>
              {whatsappStatus.error && (
                <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
                  <AlertTriangle size={14} /> {whatsappStatus.error}
                </span>
              )}
            </div>

            {whatsappStatus.status !== 'connected' && (
              <p className="text-sm text-slate-400">Click "Connect WhatsApp" to generate a new QR code and scan it with your WhatsApp mobile app.</p>
            )}
            {isWhatsappConnected && (
              <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 size={16} /> WhatsApp is connected and ready to send alerts</p>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center gap-3">
            <button
              onClick={connectWhatsApp}
              disabled={qrLoading}
              className="w-full rounded-2xl bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 px-4 py-3 text-sm font-semibold hover:bg-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {qrLoading ? <RefreshCcw size={14} className="animate-spin" /> : <Zap size={14} />}
              {qrLoading ? 'Generating QR...' : 'Connect WhatsApp'}
            </button>
            <button
              onClick={disconnectWhatsApp}
              className="w-full rounded-2xl bg-rose-500/15 text-rose-200 border border-rose-500/30 px-4 py-3 text-sm font-semibold hover:bg-rose-500/25 transition"
            >
              Disconnect WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      <AnimatePresence>
        {showQRModal && (whatsappStatus?.qr || whatsappStatus?.qrCode) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-3xl border border-slate-700 bg-slate-900 p-8 max-w-md w-full mx-4 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-4">Scan WhatsApp QR Code</h3>
              <div className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <img src={whatsappStatus.qr || whatsappStatus.qrCode} alt="WhatsApp QR Code" className="w-full rounded-xl" />
              </div>
              <p className="text-sm text-slate-400 mb-6">Open WhatsApp on your phone and scan this code to connect the admin account.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQRModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Close
                </button>
                <button
                  onClick={connectWhatsApp}
                  disabled={qrLoading}
                  className="flex-1 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold border border-cyan-500/40 transition disabled:opacity-50"
                >
                  Refresh QR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-2 pb-1">
        {[
          { id: "users", label: "User Management", icon: Users },
          { id: "logs", label: "Activity Logs", icon: Activity },
          { id: "security", label: "Security Logs", icon: Shield },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
              tab === t.id
                ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                : "text-slate-400 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-3 text-slate-500" size={15} />
              <input
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                placeholder="Search name, email, WhatsApp..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAll()}
              />
            </div>
            <select
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-xs text-slate-300 focus:border-purple-500 focus:outline-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="payment_uploaded">Payment Uploaded</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
            <span className="text-xs font-mono text-slate-400">{users.length} users</span>
          </div>

          {/* Users Table */}
          <div className="space-y-4">
            {users.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-800 p-16 text-center">
                <Users size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No users found</p>
              </div>
            )}
            {users.map((u) => (
              <motion.div
                key={u.id}
                layout
                className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl"
              >
                {/* User row */}
                <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white font-display font-extrabold text-lg shadow-md shrink-0">
                      {u.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-base text-white">{u.name}</span>
                        {u.is_admin && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold border border-purple-500/30">ADMIN</span>
                        )}
                        <StatusBadge status={u.approval_status} />
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{u.email}</p>
                      <p className="text-xs text-slate-500 font-mono">{u.whatsapp_number} • {u.selected_category}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {/* Plan badge */}
                    <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300 font-mono hidden sm:block">
                      {u.subscription_plan?.split("—")[0]?.trim()}
                    </span>

                    {/* Action buttons */}
                    {u.approval_status !== "approved" && !u.is_admin && (
                      <button
                        onClick={() => adminAction(`/api/admin/users/${u.id}/approve`, `✅ ${u.name} approved`)}
                        className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                    )}
                    {u.approval_status !== "rejected" && !u.is_admin && (
                      <button
                        onClick={() => adminAction(`/api/admin/users/${u.id}/reject`, `❌ ${u.name} rejected`)}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    )}
                    {!u.is_admin && (
                      <button
                        onClick={() => adminAction(`/api/admin/users/${u.id}/suspend`, `🔴 ${u.name} suspended`)}
                        className="px-4 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-mono text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Ban size={14} /> Suspend
                      </button>
                    )}
                    {!u.is_admin && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete ${u.email}? This cannot be undone.`)) {
                            adminAction(`/api/admin/users/${u.id}`, `${u.name} deleted`, "DELETE");
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 font-mono text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                    {!u.is_admin && (
                      <button
                        onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1.5"
                      >
                        <Send size={14} /> Send WhatsApp
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all"
                    >
                      <ChevronDown size={14} className={`transition-transform ${expandedUser === u.id ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {expandedUser === u.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-slate-800"
                    >
                      <div className="p-5 space-y-4 bg-slate-950/50">
                        {/* Payment Screenshot */}
                        {u.payment_screenshot && (
                          <div className="space-y-2">
                            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Payment Screenshot</p>
                            <a
                              href={`${API_BASE_URL}${u.payment_screenshot}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono transition-all"
                            >
                              <Eye size={14} /> View Screenshot ↗
                            </a>
                          </div>
                        )}

                        {/* Send WhatsApp notice */}
                        <div className="space-y-3">
                          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Send WhatsApp Notice</p>
                                <p className="text-sm text-slate-200 mt-1">Message will be sent to this user&apos;s WhatsApp number.</p>
                              </div>
                              <div className="text-xs text-slate-500 font-mono">
                                {u.whatsapp_number || 'No WhatsApp number configured'}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-col gap-3">
                              <textarea
                                rows={3}
                                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none font-mono resize-none"
                                placeholder="Type a WhatsApp message to send to this user..."
                                value={noticeMsg[u.id] || ""}
                                onChange={(e) => setNoticeMsg({ ...noticeMsg, [u.id]: e.target.value })}
                              />
                              <button
                                onClick={() => sendNotice(u.id)}
                                disabled={!noticeMsg[u.id]?.trim() || !u.whatsapp_number || !isWhatsappConnected}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-mono text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                <Send size={14} /> Send WhatsApp Message
                              </button>
                              {!u.whatsapp_number && (
                                <p className="text-xs text-rose-300 font-mono">This user has no WhatsApp number configured.</p>
                              )}
                              {!isWhatsappConnected && (
                                <p className="text-xs text-amber-300 font-mono">Connect WhatsApp from the gateway card above to enable admin messaging.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* User details */}
                        <div className="grid sm:grid-cols-3 gap-3 text-xs font-mono text-slate-400">
                          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                            <span className="text-slate-600 block">Plan</span>
                            <span className="text-slate-200 mt-0.5 block">{u.subscription_plan}</span>
                          </div>
                          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                            <span className="text-slate-600 block">Category</span>
                            <span className="text-slate-200 mt-0.5 block">{u.selected_category}</span>
                          </div>
                          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                            <span className="text-slate-600 block">Joined</span>
                            <span className="text-slate-200 mt-0.5 block">{new Date(u.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {tab === "logs" && (
        <div className="space-y-4">
          <h2 className="font-display font-extrabold text-xl text-white flex items-center gap-2">
            <Activity size={20} className="text-purple-400" /> Recent Admin Activity Logs
          </h2>
          {logs.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-800 p-16 text-center">
              <Activity size={40} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No logs yet</p>
            </div>
          )}
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono font-bold">{log.action}</span>
                    {log.target_user_id && (
                      <span className="text-slate-500 font-mono">User #{log.target_user_id}</span>
                    )}
                  </div>
                  {log.details && <p className="text-slate-400 font-light">{log.details}</p>}
                  <p className="text-slate-600 font-mono">by {log.admin_email}</p>
                </div>
                <span className="text-slate-500 font-mono whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-4">
          <h2 className="font-display font-extrabold text-xl text-white flex items-center gap-2">
            <Shield size={20} className="text-cyan-400" /> Security Logs
          </h2>
          {securityLogs.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-800 p-16 text-center">
              <Shield size={40} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No security events yet</p>
            </div>
          )}
          <div className="space-y-3">
            {securityLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono font-bold">{log.event}</span>
                  <p className="text-slate-400 font-mono">{log.email || "anonymous"} · {log.ip_address || "unknown IP"}</p>
                  {log.details && <p className="text-slate-500">{log.details}</p>}
                </div>
                <span className="text-slate-500 font-mono whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
