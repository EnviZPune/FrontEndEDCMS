export async function retry(fn, { retries=3, baseMs=500, onRetry } = {}) {
  let attempt = 0;
  while (true) {
    try { return await fn(); }
    catch (err) {
      attempt++; if (attempt > retries) throw err;
      onRetry?.(attempt, err);
      const jitter = Math.random() * 0.4 + 0.8;
      const delay = Math.round(baseMs * Math.pow(2, attempt - 1) * jitter);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
