import { useMemo } from "react";
export function useFormErrors(err) {
  return useMemo(() => {
    if (!err) return { fieldErrors: {}, formMessage: "" };
    const any = err;
    const fieldErrors = any?.fieldErrors || {};
    const formMessage = any?.message || "There was a problem with your submission.";
    return { fieldErrors, formMessage };
  }, [err]);
}
