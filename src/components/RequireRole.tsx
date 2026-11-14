import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../lib/roles";
import type { Role } from "../lib/types";

/** UI-level guard. The real enforcement is Firestore security rules. */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { role } = useAuth();
  if (!role) return null;
  if (!roles.includes(role)) return <Navigate to={homeFor(role)} replace />;
  return <>{children}</>;
}
