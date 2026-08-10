"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draws the square IMMERSE / THE BAY mark on a canvas using the real brand
 * font, then offers it as a PNG download. Brand rule: the bunny appears only
 * with the wordmark beside it; standalone contexts get this square mark.
 */
export function LogoLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function draw() {
      const canvas = canvasRef.current;
      const probe = probeRef.current;
      if (!canvas || !probe) return;

      // resolve the next/font-mangled family name from a live element
      const family = getComputedStyle(probe).fontFamily;
      await document.fonts.load(`400 200px ${family}`, "IMMERSE");
      await document.fonts.ready;

      const S = 1024;
      const ctx = canvas.getContext("2d")!;
      canvas.width = S;
      canvas.height = S;

      // ground
      ctx.fillStyle = "#0a0514";
      ctx.fillRect(0, 0, S, S);

      // nebula haze
      const haze = ctx.createRadialGradient(S / 2, S / 2, 80, S / 2, S / 2, 620);
      haze.addColorStop(0, "rgba(139, 92, 246, 0.16)");
      haze.addColorStop(1, "rgba(139, 92, 246, 0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, S, S);

      // stars
      ctx.fillStyle = "#ece7fb";
      for (const [x, y, r, o] of [
        [128, 128, 5, 0.9], [872, 152, 3.5, 0.7], [812, 872, 4.5, 0.8],
        [176, 848, 3, 0.6], [512, 96, 3, 0.5], [928, 512, 3, 0.5],
      ] as const) {
        ctx.globalAlpha = o;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // wordmark, two lines, brand gradient
      const grad = ctx.createLinearGradient(140, 300, 884, 760);
      grad.addColorStop(0, "#ece7fb");
      grad.addColorStop(0.45, "#b9a8f0");
      grad.addColorStop(1, "#8b5cf6");
      ctx.fillStyle = grad;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      // size each line to a shared target width so the block reads as one unit
      const target = 800;
      for (const [text, y] of [
        ["IMMERSE", 480],
        ["THE BAY", 700],
      ] as const) {
        let size = 220;
        ctx.font = `${size}px ${family}`;
        size = Math.floor((size * target) / ctx.measureText(text).width);
        ctx.font = `${size}px ${family}`;
        ctx.fillText(text, S / 2, y + (size - 190) / 2);
      }

      // baseline accent
      const rule = ctx.createLinearGradient(212, 0, 812, 0);
      rule.addColorStop(0, "rgba(110, 232, 247, 0)");
      rule.addColorStop(0.5, "rgba(110, 232, 247, 0.9)");
      rule.addColorStop(1, "rgba(226, 99, 240, 0)");
      ctx.fillStyle = rule;
      ctx.fillRect(212, 790, 600, 5);

      setReady(true);
    }
    void draw();
  }, []);

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "itb-logo-square.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8">
      <span ref={probeRef} className="font-brand sr-only" aria-hidden>
        probe
      </span>
      <canvas
        ref={canvasRef}
        style={{ width: 400, height: 400 }}
        className="rounded-2xl border border-line"
      />
      <button
        type="button"
        onClick={download}
        disabled={!ready}
        className="btn-primary"
        data-testid="download-logo"
      >
        {ready ? "Download 1024×1024 PNG" : "Rendering…"}
      </button>
    </main>
  );
}
