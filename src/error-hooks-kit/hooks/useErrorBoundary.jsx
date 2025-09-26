import React, { createContext, useContext, useMemo, useState } from "react";
import { AppError } from "../lib/errors";

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { if (this.props.onError) this.props.onError(error, info); }
  render() {
    return this.state.error ? (this.props.fallback ?? <div role="alert">Something went wrong.</div>) : this.props.children;
  }
}

const ErrorCtx = createContext({ setErr: (()=>{}) });

export function ErrorProvider({ children }) {
  const [err, setErr] = useState(null);
  const value = useMemo(()=>({ setErr }), []);
  if (err) {
    queueMicrotask(()=> setErr(null));
    throw err instanceof Error ? err : new AppError({ kind: "Unknown", message: String(err) });
  }
  return <ErrorCtx.Provider value={value}>{children}</ErrorCtx.Provider>;
}

export function useErrorBoundary() {
  const { setErr } = useContext(ErrorCtx);
  return { showError: setErr };
}
