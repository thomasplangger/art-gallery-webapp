import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const API_BASE = (() => {
  if (typeof window !== "undefined" && window.__API_FAST__) {
    return window.__API_FAST__;
  }
  if (typeof location !== "undefined") {
    const h = location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1";
    return isLocal ? "http://localhost:8001/api" : "https://api.jpart.at/api";
  }
  return "https://api.jpart.at/api";
})();

async function getJSON(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", ...opts });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || json.error || `HTTP ${res.status}`);
  return json;
}

const AdminContext = createContext({
  isAdmin: false,
  ready: false,
  login: async () => false,
  logout: async () => {},
});

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJSON(`${API_BASE}/auth/me`);
        setIsAdmin(!!data?.isAdmin);
      } catch {
        setIsAdmin(false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async (password) => {
    try {
      await getJSON(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const me = await getJSON(`${API_BASE}/auth/me`, { credentials: "include" });
      const ok = !!me?.isAdmin;
      setIsAdmin(ok);
      return ok;
    } catch {
      setIsAdmin(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await getJSON(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    setIsAdmin(false);
  };

  const value = useMemo(() => ({ isAdmin, ready, login, logout }), [isAdmin, ready]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
