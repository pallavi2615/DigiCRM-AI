const API_URL = "https://tucking-reborn-dislodge.ngrok-free.dev";

let refreshPromise: Promise<string | null> | null = null;

const AUTH_ENDPOINTS = [
  "/api/v1/auth/signin",
  "/api/v1/auth/signup",
  "/api/v1/auth/refresh",
];
function extractErrorMessage(
  data: unknown,
  status: number
): string {
  // Plain text response
  if (typeof data === "string") {
    // Sometimes backend sends JSON as a string
    try {
      const parsed = JSON.parse(data);
      return extractErrorMessage(parsed, status);
    } catch {
      return data || `API Error: ${status}`;
    }
  }

  if (data && typeof data === "object") {
    const error = data as any;

    // FastAPI standard error
    if (typeof error.detail === "string") {
      return error.detail;
    }

    // FastAPI validation errors
    if (Array.isArray(error.detail)) {
      return error.detail
        .map((item: any) => {
          if (typeof item === "string") {
            return item;
          }

          return (
            item?.msg ||
            item?.message ||
            "Invalid input"
          );
        })
        .filter(Boolean)
        .join(", ");
    }

    // Generic backend formats
    if (typeof error.message === "string") {
      return error.message;
    }

    if (typeof error.msg === "string") {
      return error.msg;
    }

    if (typeof error.error === "string") {
      return error.error;
    }

    if (
      error.error &&
      typeof error.error === "object" &&
      typeof error.error.message === "string"
    ) {
      return error.error.message;
    }
  }

  return `API Error: ${status}`;
}

/**
 * Convert an unsuccessful Response into a readable Error.
 */
async function createApiError(
  response: Response
): Promise<Error> {
  try {
    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();

      return new Error(
        extractErrorMessage(data, response.status)
      );
    }

    const text = await response.text();

    return new Error(
      extractErrorMessage(text, response.status)
    );
  } catch {
    return new Error(`API Error: ${response.status}`);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");

  if (!refreshToken) {
    return null;
  }

  try {
    const res = await fetch(
      `${API_URL}/api/v1/auth/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      }
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    localStorage.setItem(
      "access_token",
      data.access_token
    );

    localStorage.setItem(
      "refresh_token",
      data.refresh_token
    );

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
  headers.set(
    "ngrok-skip-browser-warning",
    "true"
  );

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  const isAuthEndpoint = AUTH_ENDPOINTS.some(
    (e) => endpoint.startsWith(e)
  );

  // Handle expired access token
  if (
    response.status === 401 &&
    !isRetry &&
    !isAuthEndpoint
  ) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(
        () => {
          refreshPromise = null;
        }
      );
    }

    const newToken = await refreshPromise;

    if (newToken) {
      return apiFetch<T>(
        endpoint,
        options,
        true
      );
    }

    logoutAndRedirect();

    throw new Error(
      "Session expired. Please log in again."
    );
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  return response.json() as Promise<T>;
}


// For file uploads
export async function apiUpload<T = any>(
  endpoint: string,
  formData: FormData,
  isRetry = false
): Promise<T> {
  const token = localStorage.getItem("access_token");

  const headers = new Headers();

  headers.set(
    "ngrok-skip-browser-warning",
    "true"
  );

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      method: "POST",
      headers,
      body: formData,
    }
  );

  if (
    response.status === 401 &&
    !isRetry
  ) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(
        () => {
          refreshPromise = null;
        }
      );
    }

    const newToken = await refreshPromise;

    if (newToken) {
      return apiUpload<T>(
        endpoint,
        formData,
        true
      );
    }

    logoutAndRedirect();

    throw new Error(
      "Session expired. Please log in again."
    );
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  return response.json() as Promise<T>;
}


// For file downloads
export async function apiDownload(
  endpoint: string,
  filename: string,
  isRetry = false
): Promise<void> {
  const token = localStorage.getItem("access_token");

  const headers = new Headers();

  headers.set(
    "ngrok-skip-browser-warning",
    "true"
  );

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      headers,
    }
  );

  if (
    response.status === 401 &&
    !isRetry
  ) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(
        () => {
          refreshPromise = null;
        }
      );
    }

    const newToken = await refreshPromise;

    if (newToken) {
      return apiDownload(
        endpoint,
        filename,
        true
      );
    }

    logoutAndRedirect();

    throw new Error(
      "Session expired. Please log in again."
    );
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  const blob = await response.blob();

  const url =
    window.URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
}