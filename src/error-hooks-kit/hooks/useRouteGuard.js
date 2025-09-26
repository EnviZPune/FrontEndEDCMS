import { useEffect } from "react";
export function useRouteGuard(error, navigate, { redirectTo="/login" } = {}) {
  useEffect(() => {
    if (!error) return;
    if (error?.kind === "Unauthorized") navigate(redirectTo);
  }, [error, navigate, redirectTo]);
}
