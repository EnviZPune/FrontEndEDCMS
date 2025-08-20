export function normalizeErrorPayload(payload, status) {
  const messages = [];
  const fields = {};

  if (!payload) {
    messages.push(status >= 500 ? "Server error. Please try again." : "Request failed.");
    return { messages, fields };
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    // Avoid dumping whole HTML error pages
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      messages.push(status >= 500 ? "Server error (HTML response)." : `Request failed (HTTP ${status}).`);
    } else {
      messages.push(trimmed);
    }
    return { messages, fields };
  }

  // RFC 7807 ProblemDetails
  if (payload.title || payload.detail || payload.type) {
    if (payload.title) messages.push(String(payload.title));
    if (payload.detail && payload.detail !== payload.title) messages.push(String(payload.detail));
    if (payload.errors && typeof payload.errors === "object") {
      for (const [k, v] of Object.entries(payload.errors)) fields[k] = Array.isArray(v) ? v : [String(v)];
    }
    return { messages: messages.filter(Boolean), fields };
  }

  if (payload.message || payload.Message) messages.push(String(payload.message || payload.Message));
  if (payload.errors) {
    if (Array.isArray(payload.errors)) messages.push(...payload.errors.map(String));
    else if (typeof payload.errors === "object") {
      for (const [k, v] of Object.entries(payload.errors)) fields[k] = Array.isArray(v) ? v : [String(v)];
    }
  }
  if (payload.error || payload.Error) messages.push(String(payload.error || payload.Error));

  // Fallback hints
  for (const k of ["detail", "title", "Description", "Reason"]) {
    if (payload[k]) messages.push(String(payload[k]));
  }

  return { messages: messages.filter(Boolean), fields };
}
