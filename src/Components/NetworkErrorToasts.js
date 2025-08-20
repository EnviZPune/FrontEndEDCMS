import React, { useEffect, useState } from "react";
import { onNetworkError } from "../lib/errorBus";
import "../Styling/network-error-toasts.css";

export default function NetworkErrorToasts() {
  const [queue, setQueue] = useState([]); // [{id, url, status, messages}]

  useEffect(() => {
    let idCounter = 1;
    const off = onNetworkError(({ url, status, messages }) => {
      const id = idCounter++;
      setQueue((q) => [...q, { id, url, status, messages }]);
      // Auto-dismiss after a few seconds
      setTimeout(() => setQueue((q) => q.filter((t) => t.id !== id)), 7000);
    });
    return off;
  }, []);

  if (queue.length === 0) return null;

  return (
    <div className="neterr-toasts">
      {queue.map(({ id, url, status, messages }) => (
        <div key={id} className="neterr-toast" role="alert" aria-live="assertive">
          <div className="neterr-head">
            <span className="neterr-status">HTTP {status || "?"}</span>
            <button className="neterr-close" onClick={() => setQueue((q) => q.filter((t) => t.id !== id))}>×</button>
          </div>
          <ul className="neterr-list">
            {(messages && messages.length ? messages : ["Request failed."]).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
