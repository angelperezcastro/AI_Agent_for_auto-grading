import axios from "axios";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const ACCESS_TOKEN_STORAGE_KEY = "access_token";
const USER_STORAGE_KEY = "user";

function normalizeBaseUrl(url) {
  return String(url || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function getStoredUser() {
  try {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

export function setAuthSession({ accessToken, user }) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  }

  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";
    const isAuthRequest =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

    if (status === 401 && !isAuthRequest) {
      clearAuthSession();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error) {
  const detail = error.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        const location = Array.isArray(item.loc) ? item.loc.join(".") : null;
        const message = item.msg || item.message || "Validation error";

        return location ? `${location}: ${message}` : message;
      })
      .join(" ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (error.response?.status === 404) {
    return "The requested resource was not found.";
  }

  if (error.code === "ERR_NETWORK") {
    return "Could not connect to the backend. Check that FastAPI is running and VITE_API_URL is correct.";
  }

  if (error.message) {
    return error.message;
  }

  return "Unexpected error. Please try again.";
}

export default api;