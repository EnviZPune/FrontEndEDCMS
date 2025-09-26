import { useCallback, useRef, useState, useEffect } from "react";
import { normalizeThrown } from "../lib/errors";

export function useAsync(initial = null) {
  const mounted = useRef(true);
  const [status, setStatus] = useState(initial ? "success" : "idle");
  const [data, setData] = useState(initial);
  const [error, setError] = useState(null);

  const run = useCallback(async (thenable) => {
    setStatus("pending"); setError(null);
    try {
      const result = await thenable;
      if (mounted.current) { setData(result); setStatus("success"); }
      return result;
    } catch (e) {
      const err = normalizeThrown(e);
      if (mounted.current) { setError(err); setStatus("error"); }
      throw err;
    }
  }, []);

  const reset = useCallback(() => { setStatus("idle"); setError(null); setData(initial); }, [initial]);
  useEffect(() => () => { mounted.current = false; }, []);

  return { status, data, error, run, reset,
    isIdle: status==='idle', isLoading: status==='pending', isError: status==='error', isSuccess: status==='success' };
}
