import { useEffect, useState } from "react";

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
}

export function useUser() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error("Invalid user data in localStorage", e);
      }
    }
  }, []);

  return { user };
}