"use client";

import { useEffect, useState } from "react";
import {
  AVATAR_FRAME_STORAGE_KEY,
  parseAvatarFrameEffect,
  type AvatarFrameEffect,
} from "@/lib/avatar-frame";

export const AVATAR_FRAME_CHANGE_EVENT = "cc-ops-avatar-frame-change";

export function persistAvatarFrameEffect(effect: AvatarFrameEffect) {
  localStorage.setItem(AVATAR_FRAME_STORAGE_KEY, effect);
  window.dispatchEvent(
    new CustomEvent<AvatarFrameEffect>(AVATAR_FRAME_CHANGE_EVENT, {
      detail: effect,
    })
  );
}

/** Marco del avatar del usuario actual (localStorage + sync entre sidebar/header). */
export function useAvatarFrameEffect(): AvatarFrameEffect {
  const [effect, setEffect] = useState<AvatarFrameEffect>("gold");

  useEffect(() => {
    setEffect(
      parseAvatarFrameEffect(localStorage.getItem(AVATAR_FRAME_STORAGE_KEY))
    );

    function onCustomChange(e: Event) {
      const next = (e as CustomEvent<AvatarFrameEffect>).detail;
      setEffect(
        next ?? parseAvatarFrameEffect(localStorage.getItem(AVATAR_FRAME_STORAGE_KEY))
      );
    }

    function onStorage(e: StorageEvent) {
      if (e.key === AVATAR_FRAME_STORAGE_KEY) {
        setEffect(parseAvatarFrameEffect(e.newValue));
      }
    }

    window.addEventListener(AVATAR_FRAME_CHANGE_EVENT, onCustomChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AVATAR_FRAME_CHANGE_EVENT, onCustomChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return effect;
}
