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
  const [enabled, setEnabled] = useState<boolean>(() => {
    const raw = localStorage.getItem(storageKey);
    return raw === "1"; // saved state, but will only play on toggle
  });

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      const el = new Audio(src);
      el.loop = true;
      el.preload = "auto";
      el.volume = 0.25;
      audioRef.current = el;
    }
  }, [src]);

  // React to enabled toggle
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const tryPlay = async () => {
      try {
        await el.play();
      } catch {
        // If autoplay blocked, wait for the next gesture
        const handler = async () => {
          try {
            await el.play();
          } catch {}
          window.removeEventListener("pointerdown", handler);
          window.removeEventListener("keydown", handler);
        };
        window.addEventListener("pointerdown", handler, { once: true });
        window.addEventListener("keydown", handler, { once: true });
      }
    };

    if (enabled) {
      tryPlay();
    } else {
      el.pause(); // just pause, don't reset
    }

    localStorage.setItem(storageKey, enabled ? "1" : "0");
  }, [enabled, storageKey]);

  const toggle = () => setEnabled((e) => !e);

  return <Ctx.Provider value={{ enabled, toggle }}>{children}</Ctx.Provider>;
}
