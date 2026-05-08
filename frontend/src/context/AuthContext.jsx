import { useEffect, useState } from "react";
import { api } from "../services/api";
import { AuthContext } from "./AuthContextBase";

function decodeJwt(token) {
  try {
    const base64Url = token.split(".")[1];

    if (!base64Url) {
      return null;
    }

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function extractToken(data) {
  return data?.access_token || data?.token || data?.accessToken || null;
}

function normalizeUser(data, tokenPayload = null) {
  const source = data?.user || data || {};

  return {
    id: source.id ?? tokenPayload?.user_id ?? tokenPayload?.id ?? null,
    email: source.email ?? tokenPayload?.sub ?? tokenPayload?.email ?? "",
    full_name:
      source.full_name ??
      source.name ??
      tokenPayload?.full_name ??
      tokenPayload?.name ??
      "",
    role: source.role ?? tokenPayload?.role ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  async function loadCurrentUser(token) {
    const tokenPayload = decodeJwt(token);

    try {
      const response = await api.get("/auth/me");
      const currentUser = normalizeUser(response.data, tokenPayload);

      localStorage.setItem("user", JSON.stringify(currentUser));
      setUser(currentUser);

      return currentUser;
    } catch {
      const fallbackUser = normalizeUser(null, tokenPayload);

      if (fallbackUser.email || fallbackUser.role) {
        localStorage.setItem("user", JSON.stringify(fallbackUser));
        setUser(fallbackUser);
        return fallbackUser;
      }

      return null;
    }
  }

  useEffect(() => {
    async function bootstrapAuth() {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setLoading(false);
        return;
      }

      await loadCurrentUser(token);
      setLoading(false);
    }

    bootstrapAuth();
  }, []);

  async function login(email, password) {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const token = extractToken(response.data);

    if (!token) {
      throw new Error("Login response did not include an access token.");
    }

    localStorage.setItem("access_token", token);

    const tokenPayload = decodeJwt(token);
    const responseUser = response.data?.user
      ? normalizeUser(response.data.user, tokenPayload)
      : null;

    if (responseUser?.role) {
      localStorage.setItem("user", JSON.stringify(responseUser));
      setUser(responseUser);
      return responseUser;
    }

    const currentUser = await loadCurrentUser(token);

    if (!currentUser) {
      const fallbackUser = normalizeUser(null, tokenPayload);
      localStorage.setItem("user", JSON.stringify(fallbackUser));
      setUser(fallbackUser);
      return fallbackUser;
    }

    return currentUser;
  }

  async function register({ fullName, email, password, role }) {
    const response = await api.post("/auth/register", {
      name: fullName,
      email,
      password,
      role,
    });

    return response.data;
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
  }

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(localStorage.getItem("access_token")),
    isProfessor: user?.role === "professor",
    isStudent: user?.role === "student",
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}