import { useEffect, useMemo, useState } from "react";
import { Activity, Camera, CheckCircle2, GraduationCap, Mail, MessageSquare, Save, ShieldCheck, User } from "lucide-react";
import { API_BASE_URL, apiRequest } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const fieldsForCompletion = ["name", "email", "phone_number", "whatsapp_number", "education_details", "interests", "selected_category"];

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    whatsapp_number: "",
    education_details: "",
    interests: "",
    bio: "",
    user_type: "Student",
    user_mode: "student",
    selected_category: "Engineering opportunities",
    notifications_enabled: true,
  });

  useEffect(() => {
    async function load() {
      const data = await apiRequest("/api/settings");
      setSettings(data);
      setForm((current) => ({ ...current, ...(data.profile || {}) }));
    }
    load().catch((err) => setNotice(err.message));
  }, []);

  const completion = useMemo(() => {
    const done = fieldsForCompletion.filter((key) => String(form[key] || "").trim()).length;
    return Math.round((done / fieldsForCompletion.length) * 100);
  }, [form]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const updated = await apiRequest("/api/settings/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setSettings(updated);
      await refreshUser();
      setNotice("Profile saved successfully.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setSaving(true);
    try {
      await apiRequest("/api/settings/upload-avatar", { method: "POST", body });
      const data = await apiRequest("/api/settings");
      setSettings(data);
      setForm((current) => ({ ...current, ...(data.profile || {}) }));
      await refreshUser();
      setNotice("Avatar updated.");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-cyan-400">
        <Activity className="animate-spin" size={32} />
      </div>
    );
  }

  const avatar = form.avatar_url ? `${API_BASE_URL}${form.avatar_url}` : "";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Account Center</p>
          <h1 className="mt-2 text-3xl font-extrabold text-white">Professional Profile</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Your Gmail, WhatsApp, subscription, and alert preferences in one polished control room.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4">
          <div className="flex items-center justify-between gap-6">
            <span className="text-xs font-semibold text-slate-400">Profile completion</span>
            <span className="text-lg font-extrabold text-cyan-300">{completion}%</span>
          </div>
          <div className="mt-3 h-2 w-56 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${completion}%` }} />
          </div>
        </div>
      </div>

      {notice && <div className="mb-5 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-sm text-cyan-200">{notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <User className="m-6 text-white" size={32} />}
              </div>
              <label className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:border-cyan-500">
                <Camera className="mr-1 inline" size={14} />
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </label>
            </div>
            <h2 className="mt-5 text-xl font-extrabold text-white">{form.name || user?.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{form.email || user?.email}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 space-y-3 text-sm">
            <StatusRow icon={Mail} label="Gmail" value={settings.profile.gmail_connected ? "Connected" : "Not connected"} active={settings.profile.gmail_connected} />
            <StatusRow icon={MessageSquare} label="WhatsApp" value={form.whatsapp_number ? "Number saved" : "Missing"} active={Boolean(form.whatsapp_number)} />
            <StatusRow icon={ShieldCheck} label="Subscription" value={settings.profile.approval_status || "pending"} active={settings.profile.approval_status === "approved"} />
          </div>
        </aside>

        <form onSubmit={saveProfile} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" value={form.name} onChange={(v) => update("name", v)} />
            <Field label="Email" value={form.email} disabled />
            <Field label="Phone number" value={form.phone_number || ""} onChange={(v) => update("phone_number", v)} placeholder="+91..." />
            <Field label="WhatsApp number" value={form.whatsapp_number || ""} onChange={(v) => update("whatsapp_number", v)} placeholder="+91..." />
            <Field label="Education details" icon={GraduationCap} value={form.education_details || ""} onChange={(v) => update("education_details", v)} placeholder="B.Tech AIML, 3rd year" />
            <Field label="Interests" value={form.interests || ""} onChange={(v) => update("interests", v)} placeholder="AI, full stack, internships" />
            <Field label="Role" value={form.user_type || ""} onChange={(v) => update("user_type", v)} />
            <Field label="Alert category" value={form.selected_category || ""} onChange={(v) => update("selected_category", v)} />
          </div>
          <label className="mt-5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Bio</span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
              value={form.bio || ""}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Short context that helps Vynora prioritize your alerts."
            />
          </label>
          <div className="mt-6 flex justify-end">
            <button disabled={saving} className="rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-6 py-3 text-sm font-extrabold text-slate-950 disabled:opacity-60">
              {saving ? <Activity className="mr-2 inline animate-spin" size={16} /> : <Save className="mr-2 inline" size={16} />}
              Save profile
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, disabled }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 disabled:text-slate-500"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

function StatusRow({ icon: Icon, label, value, active }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-slate-300"><Icon size={16} className={active ? "text-emerald-400" : "text-slate-500"} />{label}</span>
      <span className={`text-xs font-bold capitalize ${active ? "text-emerald-300" : "text-amber-300"}`}>
        {active && <CheckCircle2 className="mr-1 inline" size={13} />}
        {value}
      </span>
    </div>
  );
}
