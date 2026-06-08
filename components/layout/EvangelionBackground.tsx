"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<EvangelionBackground />` — atmósfera NERV/MAGI/AT-Field.
 * Hexágonos AT-Field pulsando + readouts HUD + logo NERV + veil/grain/vignette.
 */

function subscribeEva(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsEva(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "evangelion";
}
function getServerIsEva(): boolean { return false; }

export function EvangelionBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeEva, getIsEva, getServerIsEva);
  if (theme !== "evangelion" && !htmlActive) return null;

  return (
    <div className="eva-bg print:hidden" aria-hidden="true">
      <div className="eva-logo" aria-hidden="true">NERV</div>

      <svg
        className="eva-atfield"
        viewBox="0 0 380 440"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="evaAtGrad" cx="50%" cy="50%" r="55%">
            <stop offset="0%"   stopColor="rgba(0,229,255,0.30)" />
            <stop offset="50%"  stopColor="rgba(106,44,200,0.20)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <g
          fill="url(#evaAtGrad)"
          stroke="rgba(0,229,255,0.55)"
          strokeWidth="1.5"
        >
          <polygon points="190,10 360,110 360,330 190,430 20,330 20,110" />
          <polygon points="190,50 320,130 320,310 190,390 60,310 60,130" />
          <polygon points="190,90 280,150 280,290 190,350 100,290 100,150" />
        </g>
      </svg>

      <div className="eva-hud" aria-hidden="true">
        <div className="eva-hud-readout eva-hud-tl">
          {`MAGI ▼ ONLINE\nCASPER 03 ················ OK\nMELCHIOR 01 ·············· OK\nBALTHASAR 02 ············· OK\nSYNC RATIO  ······ +042.3%\nSCAN GRID  ······· LCL/AT8`}
        </div>
        <div className="eva-hud-readout eva-hud-tr">
          {`PATTERN  : BLUE\nPHASE   : EVA-01\nDPLY    : NERV-HQ-3\nLINK    : SECURED\nMODE    : OPS DIARY`}
        </div>
        <div className="eva-hud-readout eva-hud-bl">
          {`TGT ENG ··· STAND-BY\nLCL ONLINE ··· 100%\nBROWSER /AT/  v3.9\nSEELE     ▒▒ DENIED`}
        </div>
        <div className="eva-hud-readout eva-hud-br">
          {`CCMGC ▒ DAILY OPS LOG\nCONNECTED · ENC AES-256\nUI MODE · NERV/MAGI`}
        </div>
      </div>

      <div className="eva-veil" />
      <div className="eva-grain" />
      <div className="eva-vignette" />
    </div>
  );
}
