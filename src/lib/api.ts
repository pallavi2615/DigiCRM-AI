const API_URL = "https://tucking-reborn-dislodge.ngrok-free.dev";

let refreshPromise: Promise<string | null> | null = null;

const AUTH_ENDPOINTS = [
  "/api/v1/auth/signin",
  "/api/v1/auth/signup",
  "/api/v1/auth/refresh",
];

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

function logoutAndRedirect() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/auth";
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = localStorage.getItem("access_token");

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("ngrok-skip-browser-warning", "true");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const isAuthEndpoint = AUTH_ENDPOINTS.some((e) => endpoint.startsWith(e));

  if (response.status === 401 && !isRetry && !isAuthEndpoint) {
    // Avoid multiple parallel refresh calls — share one in-flight promise
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      // Retry original request once, with the new token
      return apiFetch<T>(endpoint, options, true);
    } else {
      logoutAndRedirect();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API Error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// For file uploads (multipart/form-data) — e.g. CSV import
export async function apiUpload<T = any>(
  endpoint: string,
  formData: FormData,
  isRetry = false
): Promise<T> {
  const token = localStorage.getItem("access_token");

  const headers = new Headers();
  headers.set("ngrok-skip-browser-warning", "true");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Do NOT set Content-Type — browser sets the multipart boundary automatically

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (response.status === 401 && !isRetry) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return apiUpload<T>(endpoint, formData, true);
    } else {
      logoutAndRedirect();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API Error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// For file downloads (e.g. CSV export) — triggers a browser download
export async function apiDownload(
  endpoint: string,
  filename: string,
  isRetry = false
): Promise<void> {
  const token = localStorage.getItem("access_token");

  const headers = new Headers();
  headers.set("ngrok-skip-browser-warning", "true");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${endpoint}`, { headers });

  if (response.status === 401 && !isRetry) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return apiDownload(endpoint, filename, true);
    } else {
      logoutAndRedirect();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API Error: ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}