const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export { API_BASE_URL };

function clearAuthTokens() {
  localStorage.removeItem("mailalert_token");
  localStorage.removeItem("mailalert_refresh_token");
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("mailalert_token");
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };
  if (options.body != null && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text || "Unexpected server response" };
  }
  if (response.status === 401 && !options._retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest(path, { ...options, _retried: true });
    }
    clearAuthTokens();
  }
  if (!response.ok) {
    let errorMessage = "Request failed";
    if (typeof data.detail === "string") {
      errorMessage = data.detail;
    } else if (Array.isArray(data.detail)) {
      errorMessage = data.detail.map((err) => err.msg || JSON.stringify(err)).join(", ");
    } else if (data.detail) {
      errorMessage = JSON.stringify(data.detail);
    }
    throw new Error(errorMessage);
  }
  return data;
}

async function refreshAccessToken() {
  try {
    const refreshToken = localStorage.getItem("mailalert_refresh_token");
    if (!refreshToken) return false;
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) {
      clearAuthTokens();
      return false;
    }
    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem("mailalert_token", data.access_token);
      if (data.refresh_token) localStorage.setItem("mailalert_refresh_token", data.refresh_token);
      return true;
    }
  } catch {
    clearAuthTokens();
    return false;
  }
  return false;
}
