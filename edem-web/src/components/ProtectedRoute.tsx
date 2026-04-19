import { Navigate } from "react-router-dom";
import { getAccessToken } from "../lib/auth";

type Props = {
  children: JSX.Element;
};

export function ProtectedRoute({ children }: Props) {
  const token = getAccessToken();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
