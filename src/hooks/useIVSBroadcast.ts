// src/hooks/useIVSBroadcast.ts
'use client';

import { useCallback, useRef, useState } from 'react';
import IVSBroadcastClient, {
  BASIC_LANDSCAPE,                 // 480 p preset – works with “Basic” channel class
  BroadcastClientEvents,
  type VideoComposition,
} from 'amazon-ivs-web-broadcast';  // default + named exports ✔︎

/** One‑liner describing the full‑screen layout we’ll apply to each source */
const FULL: VideoComposition = { x: 0, y: 0, width: 1280, height: 720, index: 0 };
const PIP:  VideoComposition = { x: 960, y: 540, width: 320,  height: 180, index: 1 }; // picture‑in‑picture

export function useIVSBroadcast() {
  const clientRef = useRef<ReturnType<typeof IVSBroadcastClient.create> | null>(null);
  const [live, setLive] = useState(false);

  /** Start streaming screen + cam */
  const start = useCallback(
    async (ingestEndpoint: string, streamKey: string, preview: HTMLVideoElement) => {
      /* 1️⃣ Capture devices */
      const cam    = await navigator.mediaDevices.getUserMedia({ video: true,  audio: true });          // :contentReference[oaicite:0]{index=0}
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 } });         // :contentReference[oaicite:1]{index=1}

      /* 2️⃣ Local preview */
      preview.srcObject = cam;
      await preview.play();

      /* 3️⃣ Create IVS client (factory lives on the default export) */
      const client = IVSBroadcastClient.create({ streamConfig: BASIC_LANDSCAPE });                        // :contentReference[oaicite:2]{index=2}

      /* 4️⃣ Attach sources — NOW with mandatory VideoComposition param */
      await client.addAudioInputDevice(cam,    'mic');                                                    // audio: 2 args only :contentReference[oaicite:3]{index=3}
      await client.addVideoInputDevice(screen, 'screen', FULL);                                           // video: 3 args :contentReference[oaicite:4]{index=4}
      await client.addVideoInputDevice(cam,    'cam',    PIP);                                            // small PiP overlay

      /* 5️⃣ Listen for “activeStateChange” (boolean payload) */
      client.on(BroadcastClientEvents.ACTIVE_STATE_CHANGE, () => {
        // “connected” | “completed” both mean the broadcast is live.  :contentReference[oaicite:1]{index=1}
        const state = client.getConnectionState?.();                         // helper added in v1.26  :contentReference[oaicite:2]{index=2}
        setLive(state === 'connected' || state === 'completed');
      });
      

      /* 6️⃣ Kick off the broadcast — correct arg order is (key, endpoint) */
      await client.startBroadcast(streamKey, ingestEndpoint);                                             // 

      clientRef.current = client;
    },
    []
  );

  /** Stop & clean up */
  const stop = useCallback(async () => {
    await clientRef.current?.stopBroadcast();
    clientRef.current = null;
    setLive(false);
  }, []);

  return { start, stop, live };
}
