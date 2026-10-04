import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface PermissionsContextType {
  roles: string[];              // 👈 source of truth
  role: string | null;          // 👈 convenience (roles[0] ?? null) — backward compat
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isExecutive: boolean;
  permissions: Record<string, string[]>;
  industries: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://192.168.1.79:8000"}/api/v1/auth/my-permissions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.status === 401) {
        localStorage.removeItem("access_token");
        setRoles([]);
        setPermissions({});
        setIndustries([]);
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // 👇 Backend `role` (string) ya `roles` (array) — dono handle karo
      const rolesArr: string[] = Array.isArray(data.roles)
        ? data.roles
        : data.role
          ? [data.role]
          : [];

      setRoles(rolesArr);
      setPermissions(data.permissions || {});
      setIndustries(data.industries || []);
    } catch (err) {
      console.error("Failed to load permissions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const role = roles[0] ?? null; // primary role for legacy code

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isManager = isAdmin || roles.includes("manager");
  const isExecutive =
    roles.includes("sales_executive") || roles.includes("executive");

  return (
    <PermissionsContext.Provider
      value={{
        roles,
        role,
        isSuperAdmin,
        isAdmin,
        isManager,
        isExecutive,
        permissions,
        industries,
        loading,
        refresh,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error("usePermissions must be used within <PermissionsProvider>");
  }
  return ctx;
};