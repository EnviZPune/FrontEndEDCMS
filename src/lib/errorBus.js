const listeners = new Set();

export function onNetworkError(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitNetworkError(payload) {
  // payload: { status, url, messages: string[], fields?: Record<string,string[]> }
  for (const fn of listeners) fn(payload);
}
