// import { useCallback, useEffect, useState } from "react";
// import { apiFetch } from "@/lib/api";

// export type AppRole = "super_admin" | "admin" | "sales_manager" | "sales_executive";

// interface StoredUser {
//   id: string | number;
//   email: string;
//   full_name?: string | null;
//   role?: AppRole;
//   roles?: AppRole[];
// }

// export interface AuthState {
//   user: StoredUser | null;
//   roles: AppRole[];
//   loading: boolean;
// }

// const AUTH_EVENT = "auth-changed";

// const AUTH_KEYS = [
//   "access_token",
//   "refresh_token",
//   "user",
//   "tenant",
//   "permissions",
//   "role",
// ];

// /** Same tab ke saare useAuth() instances ko sync karne ke liye. */
// export function notifyAuthChanged() {
//   window.dispatchEvent(new Event(AUTH_EVENT));
// }

// /** Local session data saaf karo (backend call nahi karta). */
// export function clearAuthStorage() {
//   AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
//   sessionStorage.removeItem("signup_tenant");
//   notifyAuthChanged();
// }

// function readAuthFromStorage(): { user: StoredUser | null; roles: AppRole[] } {
//   try {
//     const token = localStorage.getItem("access_token");
//     const raw = localStorage.getItem("user");
//     if (!token || !raw) return { user: null, roles: [] };

//     const user = JSON.parse(raw) as StoredUser;
//     const roles = user.roles ?? (user.role ? [user.role] : []);
//     return { user, roles };
//   } catch {
//     return { user: null, roles: [] };
//   }
// }

// export function useAuth(): AuthState & {
//   isAdmin: boolean;
//   isManager: boolean;
//   hasRole: (r: AppRole) => boolean;
//   logout: () => Promise<void>;
// } {
//   const [state, setState] = useState<AuthState>({ user: null, roles: [], loading: true });

//   useEffect(() => {
//     const sync = () => setState({ ...readAuthFromStorage(), loading: false });

//     sync();

//     // Doosre tab mein login/logout
//     function onStorage(e: StorageEvent) {
//       if (e.key === "access_token" || e.key === "user") sync();
//     }

//     window.addEventListener("storage", onStorage);
//     // Same tab mein login/logout
//     window.addEventListener(AUTH_EVENT, sync);

//     return () => {
//       window.removeEventListener("storage", onStorage);
//       window.removeEventListener(AUTH_EVENT, sync);
//     };
//   }, []);

//   const isAdmin = state.roles.includes("super_admin") || state.roles.includes("admin");
//   const isManager = isAdmin || state.roles.includes("sales_manager");

//   const logout = useCallback(async () => {
//     // Backend par refresh token invalidate karo
//     try {
//       const token = localStorage.getItem("access_token");
//       if (token) {
//         await apiFetch("/api/v1/auth/logout", {
//           method: "POST",
//           headers: { Authorization: `Bearer ${token}` },
//         });
//       }
//     } catch {
//       // Network/401 fail ho to bhi local logout hona chahiye
//     }

//     clearAuthStorage();
//     setState({ user: null, roles: [], loading: false });
//   }, []);

//   return {
//     ...state,
//     isAdmin,
//     isManager,
//     hasRole: (r) => state.roles.includes(r),
//     logout,
//   };
// }


import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type AppRole = "super_admin" | "admin" | "sales_manager" | "sales_executive";

interface StoredUser {
  id: string | number;
  email: string;
  full_name?: string | null;
  role?: AppRole;
  roles?: AppRole[];
}

export interface AuthState {
  user: StoredUser | null;
  roles: AppRole[];
  loading: boolean;
}

const AUTH_EVENT = "auth-changed";

const AUTH_KEYS = [
  "access_token",
  "refresh_token",
  "user",
  "tenant",
  "permissions",
  "role",
];

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearAuthStorage() {
  AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem("signup_tenant");
  notifyAuthChanged();
}

function readAuthFromStorage(): { user: StoredUser | null; roles: AppRole[] } {
  try {
    const token = localStorage.getItem("access_token");
    const raw = localStorage.getItem("user");
    if (!token || !raw) return { user: null, roles: [] };

    const user = JSON.parse(raw) as StoredUser;
    const roles = user.roles ?? (user.role ? [user.role] : []);
    return { user, roles };
  } catch {
    return { user: null, roles: [] };
  }
}

export function useAuth(): AuthState & {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isExecutive: boolean;
  hasRole: (r: AppRole) => boolean;
  logout: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ user: null, roles: [], loading: true });

  useEffect(() => {
    const sync = () => setState({ ...readAuthFromStorage(), loading: false });

    sync();

    function onStorage(e: StorageEvent) {
      if (e.key === "access_token" || e.key === "user") sync();
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(AUTH_EVENT, sync);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AUTH_EVENT, sync);
    };
  }, []);

  const isSuperAdmin = state.roles.includes("super_admin");
  const isAdmin = isSuperAdmin || state.roles.includes("admin");
  const isManager = isAdmin || state.roles.includes("sales_manager");
  const isExecutive = state.roles.includes("sales_executive");

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (token) {
        await apiFetch("/api/v1/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }

    clearAuthStorage();
    setState({ user: null, roles: [], loading: false });
  }, []);

  return {
    ...state,
    isSuperAdmin,
    isAdmin,
    isManager,
    isExecutive,
    hasRole: (r) => state.roles.includes(r),
    logout,
  };
}