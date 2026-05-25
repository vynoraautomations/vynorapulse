import { createClient } from "@supabase/supabase-js";
import { apiRequest } from "./api.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://kpurpdeyxwngmubrjpkd.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_v_5o21SMGLMTpt_MH3oBNw_e0_558Xn";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function backendAuthRequest(path, payload) {
  return apiRequest(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function getBackendProfile() {
  return apiRequest("/api/auth/me");
}

function storeAuthTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem("mailalert_token", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem("mailalert_refresh_token", refreshToken);
  }
}

function clearAuthTokens() {
  localStorage.removeItem("mailalert_token");
  localStorage.removeItem("mailalert_refresh_token");
}

function createLegacySession(accessToken, refreshToken, user) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user,
  };
}

/**
 * Sign up with email/password and create user profile
 */
export async function signUpWithEmail(email, password, profileData) {
  try {
    const normalizedEmail = email.toLowerCase();

    const authPayload = {
      name: profileData.name || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      password,
      phone_number: profileData.phone_number || "",
      whatsapp_number: profileData.whatsapp_number || profileData.phone_number || "",
      user_type: profileData.user_type || "Student",
      user_mode: profileData.user_mode || "student",
      selected_category: profileData.selected_category || "Engineering opportunities",
      subscription_plan: profileData.subscription_plan || "student-basic",
    };

    const authResponse = await backendAuthRequest("/api/auth/signup", authPayload);
    storeAuthTokens(authResponse.access_token, authResponse.refresh_token);

    const profile = await getBackendProfile();
    const currentToken = localStorage.getItem("mailalert_token");
    const currentRefreshToken = localStorage.getItem("mailalert_refresh_token");

    return {
      user: profile,
      session: createLegacySession(currentToken, currentRefreshToken, profile),
      profile,
    };
  } catch (error) {
    console.error("Signup error:", error);
    throw new Error(error.message || "Signup failed");
  }
}

/**
 * Sign in with email/password
 */
export async function signInWithEmail(email, password) {
  try {
    const authResponse = await backendAuthRequest("/api/auth/login", {
      email: email.toLowerCase(),
      password,
    });

    storeAuthTokens(authResponse.access_token, authResponse.refresh_token);
    const profile = await getBackendProfile();

    const currentToken = localStorage.getItem("mailalert_token");
    const currentRefreshToken = localStorage.getItem("mailalert_refresh_token");

    return {
      user: profile,
      session: createLegacySession(currentToken, currentRefreshToken, profile),
      profile,
    };
  } catch (error) {
    console.error("Login error:", error);
    throw new Error(error.message || "Login failed");
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "profile email",
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(error.message || "Google sign in failed");
  }
}

/**
 * Get the current session and user profile
 */
export async function getSession() {
  try {
    const accessToken = localStorage.getItem("mailalert_token");
    if (accessToken) {
      try {
        const profile = await getBackendProfile();
        const restoredAccessToken = localStorage.getItem("mailalert_token");
        const restoredRefreshToken = localStorage.getItem("mailalert_refresh_token");
        return {
          user: profile,
          session: createLegacySession(restoredAccessToken, restoredRefreshToken, profile),
          profile,
        };
      } catch (backendError) {
        console.warn("Backend session restore failed:", backendError);
        clearAuthTokens();
      }
    }

    // Fallback to Supabase for Google and existing Supabase sessions.
    let sessionData = null;
    let sessionError = null;

    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Session fetch timeout")), 2000)
        ),
      ]);
      sessionData = result.data;
      sessionError = result.error;
    } catch (err) {
      if (err.message === "Session fetch timeout") {
        console.warn("Session fetch timed out");
        return null;
      }
      throw err;
    }

    if (sessionError) throw sessionError;

    if (!sessionData?.session) {
      return null;
    }

    let profile = null;
    try {
      const result = await Promise.race([
        supabase
          .from("users")
          .select("*")
          .eq("id", sessionData.session.user.id)
          .single(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Profile fetch timeout")), 1500)
        ),
      ]);

      if (result.error && result.error.code !== "PGRST116") {
        console.warn("Profile fetch error:", result.error);
      }

      profile = result.data || null;
    } catch (profileErr) {
      if (profileErr.message === "Profile fetch timeout") {
        console.warn("Profile fetch timed out");
      } else {
        console.warn("Error fetching profile:", profileErr);
      }
    }

    return {
      user: sessionData.session.user,
      session: sessionData.session,
      profile,
    };
  } catch (error) {
    console.error("Session error:", error);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateProfile(userId, updates) {
  try {
    const accessToken = localStorage.getItem("mailalert_token");
    if (accessToken) {
      return apiRequest("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(error.message || "Failed to update profile");
  }
}

/**
 * Sign out
 */
export async function signOut() {
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.warn("Backend logout failed:", error);
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw new Error(error.message || "Logout failed");
  } finally {
    clearAuthTokens();
  }
}

/**
 * Set up auth state listener
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
