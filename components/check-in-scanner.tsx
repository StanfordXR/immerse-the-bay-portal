"use client";

import { useEffect, useRef, useState } from "react";

export function CheckInScanner({ disabled, onCode, scanning, setScanning }: {
  disabled: boolean;
  onCode: (code: string) => void;
  scanning: boolean;
  setScanning: (scanning: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    if (!video) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let animation = 0;
    let lastRead = -Infinity;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(animation);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
    const fail = () => {
      if (stopped) return;
      stop();
      setScanning(false);
      setError("The camera couldn’t start or read a frame. Check browser camera access, or use name search.");
    };

    async function start(element: HTMLVideoElement) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (stopped) {
        camera.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = camera;
      element.srcObject = camera;
      await element.play();
      const { default: decode } = await import("jsqr");
      if (stopped) return;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      const draw = (time: number) => {
        if (stopped) return;
        if (element.videoWidth > 0 && element.readyState >= 2 && time - lastRead >= 125) {
          lastRead = time;
          try {
            const width = Math.min(960, element.videoWidth);
            const height = Math.max(1, Math.round(element.videoHeight * width / element.videoWidth));
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width;
              canvas.height = height;
            }
            context.drawImage(element, 0, 0, width, height);
            const frame = context.getImageData(0, 0, width, height);
            const result = decode(frame.data, width, height);
            if (result?.data) {
              stop();
              setScanning(false);
              onCode(result.data);
              return;
            }
          } catch {
            fail();
            return;
          }
        }
        animation = requestAnimationFrame(draw);
      };
      animation = requestAnimationFrame(draw);
    }

    void start(video).catch(fail);
    return stop;
  }, [scanning, setScanning, onCode]);

  return (
    <section className="card h-fit space-y-3 p-5" aria-labelledby="scan-title">
      <h2 className="font-display text-lg font-semibold" id="scan-title">Scan a badge</h2>
      <p className="text-sm text-muted">Point your camera at the attendee’s badge. A valid code checks them in immediately.</p>
      <video
        ref={videoRef}
        aria-label="Check-in camera preview"
        className={scanning ? "aspect-video w-full rounded-md bg-black object-contain" : "hidden"}
        muted
        autoPlay
        playsInline
      />
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button
        type="button"
        className={scanning ? "btn-ghost" : "btn-primary"}
        disabled={disabled && !scanning}
        onClick={() => {
          setError("");
          setScanning(!scanning);
        }}
      >
        {scanning ? "Stop camera" : "Open camera"}
      </button>
    </section>
  );
}
