// src/hooks/useDualBroadcast.ts
'use client';

import { useCallback, useRef, useState } from 'react';
import IVSBroadcastClient, {
  BASIC_FULL_HD_LANDSCAPE, // 1920×1080 preset
  BASIC_LANDSCAPE,         // 640×360 preset
  type VideoComposition,
} from 'amazon-ivs-web-broadcast';

type Client = ReturnType<typeof IVSBroadcastClient.create>;

interface Endpoints {
  screen: { ingestEndpoint: string; streamKey: string };
  camera: { ingestEndpoint: string; streamKey: string };
  preview: HTMLVideoElement;
}

export function useDualBroadcast() {
  const screenRef = useRef<Client | null>(null);
  const camRef    = useRef<Client | null>(null);
  const [live, setLive] = useState(false);

  const start = useCallback(async (cfg: Endpoints) => {
    /* 1️⃣ capture sources */
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 15 },
    });
    const camOrig = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    /* 2️⃣ clone cam tracks so we can publish twice */
    const camVidClone = camOrig.getVideoTracks()[0].clone();
    const camAudClone = camOrig.getAudioTracks()[0].clone();

    /* 3️⃣ local preview */
    cfg.preview.srcObject = new MediaStream([camVidClone]);
    await cfg.preview.play();

    /* 4️⃣ screen client — full‑frame composition */
    const { width = 1920, height = 1080 } =
      screenStream.getVideoTracks()[0].getSettings();

    const fullFrame: VideoComposition = { x: 0, y: 0, width, height, index: 0 };

    const sc = IVSBroadcastClient.create({
      streamConfig: BASIC_FULL_HD_LANDSCAPE,
    });
    await sc.addVideoInputDevice(
      new MediaStream([screenStream.getVideoTracks()[0]]),
      'screen',
      fullFrame
    );
    await sc.startBroadcast(cfg.screen.streamKey, cfg.screen.ingestEndpoint);
    screenRef.current = sc;

    /* 5️⃣ camera client (separate channel) */
    const camFrame: VideoComposition = {
      x: 0,
      y: 0,
      width: 640,
      height: 360,
      index: 0,
    };

    const cc = IVSBroadcastClient.create({
      streamConfig: BASIC_LANDSCAPE,
    });
    await cc.addVideoInputDevice(
      new MediaStream([camVidClone]),
      'cam',
      camFrame
    );
    await cc.addAudioInputDevice(
      new MediaStream([camAudClone]),
      'mic'
    );
    await cc.startBroadcast(cfg.camera.streamKey, cfg.camera.ingestEndpoint);
    camRef.current = cc;

    setLive(true);
  }, []);

  const stop = useCallback(async () => {
    await Promise.all([
      screenRef.current?.stopBroadcast(),
      camRef.current?.stopBroadcast(),
    ]);
    screenRef.current = camRef.current = null;
    setLive(false);
  }, []);

  return { start, stop, live };
}
