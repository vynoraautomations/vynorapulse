import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../services/api.js";
import RazorpayPayment from "../components/RazorpayPayment.jsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, CheckCircle2, Clock, AlertTriangle, Copy, Zap,
  CreditCard, Smartphone, Shield, Loader2
} from "lucide-react";

const DEFAULT_PLANS = [
  {
    id: "student-basic",
    label: "Student Basic",
    price: "₹29",
    amount_inr: 29,
    period: "/month",
    color: "from-cyan-500 to-blue-600",
    border: "border-cyan-500/50",
    glow: "shadow-[0_0_25px_rgba(0,240,255,0.2)]",
    features: ["Gmail alerts", "WhatsApp alerts", "Daily digest"],
  },
  {
    id: "student-pro",
    label: "Student Pro",
    price: "₹79",
    amount_inr: 79,
    period: "/month",
    color: "from-purple-500 to-pink-600",
    border: "border-purple-500/50",
    glow: "shadow-[0_0_25px_rgba(168,85,247,0.2)]",
    features: ["Instant AI filtering", "Priority alerts", "Deadline reminders", "Opportunity ranking"],
    popular: true,
  },
  {
    id: "professional",
    label: "Professional",
    price: "₹99",
    amount_inr: 99,
    period: "/month",
    color: "from-amber-500 to-orange-600",
    border: "border-amber-500/50",
    glow: "shadow-[0_0_25px_rgba(245,158,11,0.2)]",
    features: ["Job opportunities", "Recruiter emails", "AI summaries", "Interview tracking"],
  },
  {
    id: "business",
    label: "Business",
    price: "₹199",
    amount_inr: 199,
    period: "/month",
    color: "from-emerald-500 to-teal-600",
    border: "border-emerald-500/50",
    glow: "shadow-[0_0_25px_rgba(16,185,129,0.2)]",
    features: ["Client lead alerts", "Team notifications", "Smart analytics", "Sales inquiry detection"],
  },
];

const UPI_NUMBER = "8106944811";

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState("plan"); // plan | payment | waiting
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [upgradePrompt, setUpgradePrompt] = useState(null);

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await apiRequest("/api/subscriptions/plans");
        setPlans(
          data.map((plan) => {
            const fallback = DEFAULT_PLANS.find((item) => item.id === plan.slug) || DEFAULT_PLANS[0];
            return {
              ...fallback,
              id: plan.slug,
              label: plan.name,
              price: `₹${plan.amount_inr}`,
              amount_inr: Number(plan.amount_inr),
              features: plan.features || fallback.features,
              popular: Boolean(plan.popular),
            };
          })
        );
      } catch {
        setPlans(DEFAULT_PLANS);
      }
    }

    loadPlans();
  }, []);

  useEffect(() => {
    if (!plans.length) {
      return;
    }

    const prompt = location.state;
    if (!prompt?.recommendedPlanId) {
      setUpgradePrompt(null);
      return;
    }

    const targetPlan = plans.find((plan) => plan.id === prompt.recommendedPlanId);
    if (!targetPlan) {
      setUpgradePrompt(null);
      return;
    }

    setSelectedPlan(targetPlan);
    setUpgradePrompt({
      featureName: prompt.featureName || "This feature",
      featureDescription: prompt.featureDescription || `Upgrade to ${targetPlan.label} to unlock the full experience.`,
      includedFeatures: Array.isArray(prompt.includedFeatures) && prompt.includedFeatures.length > 0 ? prompt.includedFeatures : targetPlan.features,
      planLabel: targetPlan.label,
      planPrice: targetPlan.price,
    });
  }, [location.state, plans]);

  if (user?.approval_status === "approved") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <CheckCircle2 size={56} className="mx-auto text-emerald-400" />
          <h2 className="font-display text-3xl font-extrabold text-white">Subscription Active</h2>
          <p className="text-slate-400">Your plan is approved and your AI engine is live.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm shadow-lg hover:scale-105 transition-all"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (user?.approval_status === "payment_uploaded") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-6 rounded-3xl border border-amber-500/40 bg-slate-900/80 p-10 shadow-2xl"
        >
          <div className="p-4 rounded-2xl bg-amber-500/20 w-fit mx-auto">
            <Clock size={40} className="text-amber-400 animate-pulse" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-white">Awaiting Admin Verification</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your payment screenshot has been uploaded successfully. Our team manually verifies payments and activates accounts within <strong className="text-white">2–4 hours</strong>.
          </p>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 text-left text-xs font-mono text-slate-400 space-y-1">
            <p>📧 Admin: vynoraautomations@gmail.com</p>
            <p>📱 WhatsApp: 8106944811</p>
            <p>⏱️ Verification time: 2–4 hours</p>
          </div>
          <p className="text-xs text-slate-500">You will receive a WhatsApp confirmation when approved.</p>
        </motion.div>
      </div>
    );
  }

  async function handleUpload() {
    if (!file) { setError("Please select your payment screenshot"); return; }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("mailalert_token");
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/api/subscriptions/upload-payment?plan_id=${encodeURIComponent(selectedPlan?.id || user?.subscription_plan || "")}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.detail || "Upload failed");
      }
      await refreshUser();
      setStep("waiting");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRazorpaySuccess() {
    await refreshUser();
  }

  async function startCheckout() {
    if (!selectedPlan) return;
    setCheckoutLoading(true);
    setError("");
    try {
      const res = await apiRequest("/api/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ plan_id: selectedPlan.id }),
      });
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setStep("payment");
    } catch (err) {
      setError(err.message);
      setStep("payment");
    } finally {
      setCheckoutLoading(false);
    }
  }

  function copyUPI() {
    navigator.clipboard.writeText(UPI_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="relative min-h-[calc(100vh-70px)] bg-[#030712] py-16 px-4 sm:px-6 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-20 left-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 mb-4">
            <Zap size={14} className="text-amber-400" /> VYNORA PULSE PREMIUM PLANS
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Choose Your <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">Intelligence Plan</span>
          </h1>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Activate your AI Opportunity Engine with a simple manual UPI payment. No card required, no online gateway. 100% secure.
          </p>
        </div>

        {upgradePrompt && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-3xl border border-amber-500/40 bg-amber-950/20 p-5 sm:p-6 shadow-[0_0_30px_rgba(245,158,11,0.12)]"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-bold">Upgrade Recommendation</p>
                <h2 className="font-display text-2xl font-extrabold text-white mt-2">Unlock {upgradePrompt.featureName}</h2>
                <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">{upgradePrompt.featureDescription}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {upgradePrompt.includedFeatures.map((feature) => (
                    <span key={feature} className="px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs text-amber-100">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-slate-950/70 px-5 py-4 min-w-[220px] text-left">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Recommended</p>
                <p className="text-lg font-extrabold text-white mt-1">{upgradePrompt.planLabel}</p>
                <p className="text-sm text-amber-300 font-bold">{upgradePrompt.planPrice}/month</p>
                <p className="text-xs text-slate-400 mt-2">You can pay this amount and continue using the unlocked feature immediately after verification.</p>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: Plan Selection */}
          {step === "plan" && (
            <motion.div key="plan" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`relative rounded-3xl border p-6 text-left transition-all duration-300 group ${
                      selectedPlan?.id === plan.id
                        ? `${plan.border} ${plan.glow} bg-slate-900`
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                        Most Popular
                      </div>
                    )}
                    {selectedPlan?.id === plan.id && (
                      <CheckCircle2 size={20} className="absolute top-4 right-4 text-emerald-400" />
                    )}
                    <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${plan.color} mb-4`}>
                      <CreditCard size={20} className="text-white" />
                    </div>
                    <p className="font-display font-bold text-lg text-white">{plan.label}</p>
                    <div className="flex items-baseline gap-1 mt-1 mb-4">
                      <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                      <span className="text-sm text-slate-400 font-mono">{plan.period}</span>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              <div className="text-center">
                <button
                  disabled={!selectedPlan || checkoutLoading}
                  onClick={startCheckout}
                  className="px-10 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white font-bold text-base shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:shadow-[0_0_50px_rgba(0,240,255,0.7)] hover:scale-105 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-3 mx-auto"
                >
                  {checkoutLoading ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
                  <span>{checkoutLoading ? "Opening Checkout..." : "Continue to Secure Checkout"}</span>
                </button>
                {!selectedPlan && <p className="text-xs text-slate-500 mt-3 font-mono">Please select a plan to continue</p>}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Payment */}
          {step === "payment" && (
            <motion.div key="payment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="max-w-2xl mx-auto">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-8 shadow-2xl space-y-8">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-t-3xl" style={{ position: "relative" }} />

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display font-extrabold text-2xl text-white">Complete Payment</h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Selected: <span className="text-cyan-300 font-mono font-bold">{selectedPlan.label} — {selectedPlan.price}/month</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setStep("plan")}
                      className="text-xs font-mono text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all"
                    >
                      ← Change Plan
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <CreditCard size={22} className="text-cyan-400 shrink-0" />
                        <div>
                          <p className="font-bold text-white">Option 1: Razorpay</p>
                          <p className="text-xs text-slate-400 font-mono mt-1">Instant card / UPI / wallet payment with secure checkout.</p>
                        </div>
                      </div>
                      <RazorpayPayment
                        plan={{
                          id: selectedPlan.id,
                          name: selectedPlan.label,
                          amount: selectedPlan.amount_inr * 100,
                          contact: UPI_NUMBER,
                        }}
                        onSuccess={handleRazorpaySuccess}
                      />
                    </div>

                    {/* Payment Instructions */}
                    <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-6 space-y-5">
                      <div className="flex items-center gap-3">
                        <Smartphone size={24} className="text-cyan-400 shrink-0" />
                        <div>
                          <p className="font-bold text-white">Option 2: Upload Screenshot</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">Use this if you prefer to pay via PhonePe / GPay / UPI and verify manually.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 font-mono text-sm text-white">
                          {UPI_NUMBER}
                        </div>
                        <button
                          onClick={copyUPI}
                          className={`px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            copied
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                          }`}
                        >
                          <Copy size={14} />
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>

                      <div className="rounded-xl bg-amber-950/30 border border-amber-500/30 p-4 text-xs text-amber-300 space-y-1">
                        <p className="font-bold flex items-center gap-2"><AlertTriangle size={14} /> Payment Instructions</p>
                        <p>1. Open PhonePe / GPay / any UPI app</p>
                        <p>2. Send <strong className="text-white">{selectedPlan.price}</strong> to <strong className="text-white">{UPI_NUMBER}</strong></p>
                        <p>3. Take a screenshot of your payment confirmation</p>
                        <p>4. Upload the screenshot below</p>
                      </div>
                    </div>
                  </div>

                  {/* Screenshot Upload */}
                  <div className="space-y-3">
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                      Upload Payment Screenshot *
                    </label>
                    <label
                      htmlFor="payment-screenshot"
                      className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-950/60 cursor-pointer transition-all group"
                    >
                      {file ? (
                        <>
                          <CheckCircle2 size={32} className="text-emerald-400" />
                          <p className="text-sm font-semibold text-emerald-300">{file.name}</p>
                          <p className="text-xs text-slate-500">Click to change file</p>
                        </>
                      ) : (
                        <>
                          <Upload size={32} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                          <p className="text-sm font-semibold text-slate-300 group-hover:text-white">Click to upload screenshot</p>
                          <p className="text-xs text-slate-500">PNG, JPG, JPEG up to 5MB</p>
                        </>
                      )}
                      <input
                        id="payment-screenshot"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                      <AlertTriangle size={14} /> {error}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Shield size={14} className="text-emerald-400" />
                      Screenshot stored securely and only visible to admin
                    </div>
                    <button
                      onClick={handleUpload}
                      disabled={uploading || !file}
                      className="ml-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.7)] hover:scale-105 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                    >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {uploading ? "Uploading..." : "Submit for Verification"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Waiting */}
          {step === "waiting" && (
            <motion.div key="waiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center space-y-6">
              <div className="rounded-3xl border border-amber-500/40 bg-slate-900/80 p-10 shadow-2xl">
                <div className="p-4 rounded-2xl bg-amber-500/20 w-fit mx-auto mb-5">
                  <Clock size={40} className="text-amber-400 animate-pulse" />
                </div>
                <h2 className="font-display text-2xl font-extrabold text-white">Verification in Progress</h2>
                <p className="text-slate-400 text-sm leading-relaxed mt-3">
                  Your screenshot was uploaded! Our admin manually verifies payments and will send a WhatsApp confirmation within <strong className="text-white">2–4 hours</strong>.
                </p>
                <div className="mt-6 rounded-2xl bg-slate-950 border border-slate-800 p-4 text-left text-xs font-mono text-slate-400 space-y-1">
                  <p>📱 WhatsApp Alert on: {user?.whatsapp_number}</p>
                  <p>📦 Plan: {selectedPlan?.label}</p>
                  <p>⏱️ ETA: 2–4 hours</p>
                </div>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="mt-6 px-8 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all border border-slate-700"
                >
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
