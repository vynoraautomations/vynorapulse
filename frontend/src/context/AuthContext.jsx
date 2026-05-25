import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  getSession,
  updateProfile as updateSupabaseProfile,
  signOut as supabaseSignOut,
  onAuthStateChange,
  supabase,
} from "../services/supabase.js";

const AuthContext = createContext(null);

function hasBackendSession() {
  return typeof localStorage !== "undefined" && Boolean(localStorage.getItem("mailalert_token"));
}

function clearAuthState(setUser, setProfile, setSession) {
  setUser(null);
  setProfile(null);
  setSession(null);
  localStorage.removeItem("mailalert_token");
  localStorage.removeItem("mailalert_refresh_token");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);

  // Set up the auth state listener and initialize - simplified and non-blocking
  useEffect(() => {
    let mounted = true;
    let initComplete = false;

    // Set up listener
    const { data: authListener } = onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        setSession(session);

        // Save session tokens to localStorage for API calls and refresh
        if (session.access_token) {
          localStorage.setItem("mailalert_token", session.access_token);
        }
        if (session.refresh_token) {
          localStorage.setItem("mailalert_refresh_token", session.refresh_token);
        }

        // Load profile in background
        getSession()
          .then((data) => {
            if (mounted && data?.profile) setProfile(data.profile);
          })
          .catch(() => {});
      } else if (!hasBackendSession()) {
        clearAuthState(setUser, setProfile, setSession);
        initComplete = true;
        setInitializing(false);
      } else {
        initComplete = true;
        setInitializing(false);
      }
    });

    // Also try to load session on mount
    const initSession = async () => {
      try {
        const data = await getSession();
        if (mounted) {
          if (data) {
            setUser(data.user);
            setSession(data.session);
            setProfile(data.profile);
            
            // Save session tokens for API calls and refresh
            if (data.session?.access_token) {
              localStorage.setItem("mailalert_token", data.session.access_token);
            }
            if (data.session?.refresh_token) {
              localStorage.setItem("mailalert_refresh_token", data.session.refresh_token);
            }
          }
          if (!initComplete) {
            initComplete = true;
            setInitializing(false);
          }
        }
      } catch (err) {
        if (mounted && !initComplete) {
          initComplete = true;
          setInitializing(false);
        }
      }
    };

    // Start initialization
    initSession();

    // Fallback timeout to ensure we don't block forever
    const timeoutId = setTimeout(() => {
      if (mounted && !initComplete) {
        initComplete = true;
        setInitializing(false);
      }
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  async function login(email, password) {
    try {
      setError(null);
      const data = await signInWithEmail(email, password);
      setUser(data.user);
      setSession(data.session);
      if (data.profile) setProfile(data.profile);
      
      // Save session tokens for API calls and refresh
      if (data.session?.access_token) {
        localStorage.setItem("mailalert_token", data.session.access_token);
      }
      if (data.session?.refresh_token) {
        localStorage.setItem("mailalert_refresh_token", data.session.refresh_token);
      }
      return data;
    } catch (err) {
      const errorMsg = err.message || "Login failed";
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async function signup(payload) {
    try {
      setError(null);
      const data = await signUpWithEmail(payload.email, payload.password, {
        name: payload.name,
        phone_number: payload.phone_number,
        whatsapp_number: payload.whatsapp_number,
        user_type: payload.user_type,
        user_mode: payload.user_mode,
        selected_category: payload.selected_category,
        subscription_plan: payload.subscription_plan,
        interests: payload.interests,
        bio: payload.bio,
        keywords: payload.keywords,
      });
      setUser(data.user);
      setSession(data.session);
      if (data.profile) setProfile(data.profile);
      
      // Save session tokens for API calls and refresh
      if (data.session?.access_token) {
        localStorage.setItem("mailalert_token", data.session.access_token);
      }
      if (data.session?.refresh_token) {
        localStorage.setItem("mailalert_refresh_token", data.session.refresh_token);
      }
      return data;
    } catch (err) {
      const errorMsg = err.message || "Signup failed";
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async function signupWithGoogle() {
    try {
      setError(null);
      const data = await signInWithGoogle();
      if (data?.session?.access_token) {
        localStorage.setItem("mailalert_token", data.session.access_token);
      }
      if (data?.session?.refresh_token) {
        localStorage.setItem("mailalert_refresh_token", data.session.refresh_token);
      }
    } catch (err) {
      const errorMsg = err.message || "Google sign up failed";
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async function updateProfile(updates) {
    try {
      setError(null);
      if (!user) throw new Error("No user logged in");
      const updatedProfile = await updateSupabaseProfile(user.id, updates);
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const errorMsg = err.message || "Profile update failed";
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async function refreshUser() {
    try {
      setError(null);
      const data = await getSession();
      if (!data) {
        setUser(null);
        setProfile(null);
        setSession(null);
        localStorage.removeItem("mailalert_token");
        localStorage.removeItem("mailalert_refresh_token");
        return null;
      }

      setUser(data.user);
      setSession(data.session);
      setProfile(data.profile);

      if (data.session?.access_token) {
        localStorage.setItem("mailalert_token", data.session.access_token);
      }
      if (data.session?.refresh_token) {
        localStorage.setItem("mailalert_refresh_token", data.session.refresh_token);
      }

      return data;
    } catch (err) {
      const errorMsg = err.message || "Failed to refresh user";
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  async function logout() {
    try {
      setError(null);
      await supabaseSignOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      localStorage.removeItem("mailalert_token");
      localStorage.removeItem("mailalert_refresh_token");
    } catch (err) {
      console.error("Logout error:", err);
      // Force local logout even if server fails
      setUser(null);
      setProfile(null);
      setSession(null);
      localStorage.removeItem("mailalert_token");
      localStorage.removeItem("mailalert_refresh_token");
    }
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      initializing,
      error,
      login,
      signup,
      signupWithGoogle,
      logout,
      updateProfile,
      refreshUser,
      setError,
    }),
    [user, profile, session, initializing, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
