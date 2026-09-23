import { useEffect, useState } from "react";

export type AppRole = "super_admin" | "admin" | "sales_manager" | "sales_executive";

interface StoredUser {
  id: string;
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
  isAdmin: boolean;
  isManager: boolean;
  hasRole: (r: AppRole) => boolean;
  logout: () => void;
} {
  const [state, setState] = useState<AuthState>({ user: null, roles: [], loading: true });

  useEffect(() => {
    setState({ ...readAuthFromStorage(), loading: false });

    // Keep in sync if another tab logs in/out
    function onStorage(e: StorageEvent) {
      if (e.key === "access_token" || e.key === "user") {
        setState({ ...readAuthFromStorage(), loading: false });
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isAdmin = state.roles.includes("super_admin") || state.roles.includes("admin");
  const isManager = isAdmin || state.roles.includes("sales_manager");

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setState({ user: null, roles: [], loading: false });
  }

  return {
    ...state,
    isAdmin,
    isManager,
    hasRole: (r) => state.roles.includes(r),
    logout,
  };
}