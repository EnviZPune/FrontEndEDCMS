import React, { useEffect, useState } from "react";
import { onError } from "./useGlobalErrorBus";

export default function GlobalErrorToaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onError((e) => {
      const err = e.detail;
      const id = Math.random().toString(36).slice(2);
      setItems(prev => [...prev, { id, msg: err?.message || "Unexpected error" }]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 4000);
    });
  }, []);
  return (
    <div style={{position:"fixed", right:16, bottom:16, display:"flex", flexDirection:"column", gap:8, zIndex:9999}}>
      {items.map(it => (
        <div key={it.id} style={{background:"rgba(220,38,38,0.95)", color:"#fff", padding:"10px 12px", borderRadius:8, boxShadow:"0 6px 20px rgba(0,0,0,0.2)"}}>
          {it.msg}
        </div>
      ))}
    </div>
  );
}
