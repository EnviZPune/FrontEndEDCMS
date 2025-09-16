// src/components/AudioProvider.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type AudioCtx = {
  enabled: boolean;
  toggle: () => void;
};

const Ctx = createContext<AudioCtx | null>(null);

export const useAudio = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used within <AudioProvider>");
  return ctx;
};

export function AudioProvider({
  src = "/Assets/Khepre.mp3",
  children,
  storageKey = "edcms_bgm_enabled",
}: {
  src?: string;
  children: React.ReactNode;
  storageKey?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Persisted state, but we WON'T auto-play on mount or route change.
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  // Create audio element once
  useEffect(() => {
    const el = new Audio(src);
    el.loop = true;
    el.preload = "auto";
    el.volume = 0.25;
    audioRef.current = el;

    return () => {
      try {
        el.pause();
        // release the element
        audioRef.current = null;
      } catch {}
    };
  }, []); // create once

  // Update source if `src` prop changes
  useEffect(() => {
    if (audioRef.current) audioRef.current.src = src;
  }, [src]);

  // Only persist state and pause when disabled.
  // IMPORTANT: do NOT auto-play here when enabled === true.
  useEffect(() => {
    localStorage.setItem(storageKey, enabled ? "1" : "0");
    if (!enabled && audioRef.current) {
      audioRef.current.pause();
    }
  }, [enabled, storageKey]);

  // Toggle explicitly controls playback. No global click listeners.
  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;

    setEnabled((prev) => {
      const next = !prev;
      if (next) {
        // We are inside a user gesture (the toggle click), so play is allowed.
        el.play().catch(() => {
          // If it still fails (rare), revert state.
          setEnabled(false);
        });
      } else {
        el.pause();
      }
      return next;
    });
  };

  return <Ctx.Provider value={{ enabled, toggle }}>{children}</Ctx.Provider>;
}
