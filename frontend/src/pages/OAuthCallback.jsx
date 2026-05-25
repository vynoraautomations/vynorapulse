import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getSession, supabase } from "../services/supabase.js";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { setError } = useAuth();
  const ran = useRef(false);
  const [state, setState] = useState({ status: "loading", message: "Completing Google sign in..." });

  useEffect(() => {
    async function finish() {
      if (ran.current) return;
      ran.current = true;

      try {
        // Wait for Supabase to process the OAuth callback
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Check if the session was created
        const data = await getSession();
        
        if (!data || !data.user) {
          setState({ status: "error", message: "Google authentication did not complete. Please try again." });
          return;
        }

        // Save session tokens for API calls and refresh
        if (data.session?.access_token) {
          localStorage.setItem("mailalert_token", data.session.access_token);
        }
        if (data.session?.refresh_token) {
          localStorage.setItem("mailalert_refresh_token", data.session.refresh_token);
        }

        // If no profile exists, create one or recover an existing profile if the auth trigger already created it.
        if (!data.profile) {
          try {
            const { data: createdProfile, error: createError } = await supabase
              .from("users")
              .insert({
                id: data.user.id,
                email: data.user.email.toLowerCase(),
                name: data.user.user_metadata?.name || data.user.email.split("@")[0],
                phone_number: data.user.user_metadata?.phone_number || "",
                whatsapp_number: data.user.user_metadata?.whatsapp_number || "",
                is_admin: data.user.email.toLowerCase() === "vynoraautomations@gmail.com",
                role: data.user.email.toLowerCase() === "vynoraautomations@gmail.com" ? "admin" : "user",
                approval_status: "pending",
              })
              .select()
              .single();

            if (createError) {
              const isDuplicate = createError.code === "23505" || /duplicate key/i.test(createError.message || "");
              if (isDuplicate) {
                const { data: existingProfile, error: fetchErr } = await supabase
                  .from("users")
                  .select("*")
                  .eq("id", data.user.id)
                  .single();
                if (existingProfile) {
                  data.profile = existingProfile;
                }
              } else {
                console.warn("Could not create profile:", createError);
              }
            } else if (createdProfile) {
              data.profile = createdProfile;
            }
          } catch (err) {
            console.warn("Could not create profile:", err);
          }
        }

        const needsProfileCompletion = !data.profile?.whatsapp_number || !data.profile?.selected_category || !data.profile?.email;
        setState({
          status: "success",
          message: needsProfileCompletion
            ? "Google account connected. Please complete your profile to start receiving WhatsApp alerts."
            : "Google account connected. Redirecting..."
        });

        setTimeout(
          () => navigate(data.profile?.is_admin ? "/admin" : needsProfileCompletion ? "/profile" : "/dashboard", { replace: true }),
          650
        );
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err.message);
        setState({ status: "error", message: err.message || "Failed to complete Google authentication." });
      }
    }

    finish();
  }, [navigate, setError]);

  return (
    <section className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
        {state.status === "loading" && <Activity className="mx-auto mb-4 animate-spin text-cyan-400" size={34} />}
        {state.status === "success" && <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={34} />}
        {state.status === "error" && <AlertTriangle className="mx-auto mb-4 text-rose-400" size={34} />}
        <h1 className="text-xl font-extrabold text-white">Google Authentication</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{state.message}</p>
        {state.status === "error" && (
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="mt-6 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950"
          >
            Back to sign in
          </button>
        )}
      </div>
    </section>
  );
}
