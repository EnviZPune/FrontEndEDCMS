const EVT = new EventTarget();
export function onError(handler) {
  EVT.addEventListener("app-error", handler);
  return () => EVT.removeEventListener("app-error", handler);
}
export function emitError(err) {
  EVT.dispatchEvent(new CustomEvent("app-error", { detail: err }));
}
