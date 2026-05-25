import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import OAuthCallback from "./pages/OAuthCallback.jsx";
import Profile from "./pages/Profile.jsx";
import Subscription from "./pages/Subscription.jsx";
import Admin from "./pages/Admin.jsx";
import "./index.css";

function ProtectedRoute({ children, requireAdmin = false }) {
  const { session, profile, initializing } = useAuth();
  
  // If still initializing, show minimal loading state
  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-cyan-500 text-lg mb-4">Loading...</div>
          <div className="text-slate-400 text-sm">Restoring your session</div>
        </div>
      </div>
    );
  }
  
  // Not logged in - redirect to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  
  // Check admin requirement
  if (requireAdmin && !profile?.is_admin && profile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <Subscription />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
