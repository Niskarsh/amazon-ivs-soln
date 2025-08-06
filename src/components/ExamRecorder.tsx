'use client';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDualBroadcast } from '@/hooks/useDualBroadcast';

type IvCreds = {
  screen: { ingestEndpoint: string; streamKey: string };
  camera: { ingestEndpoint: string; streamKey: string };
};

export default function ExamRecorder({ examId }: { examId: string }) {
  const videoRef              = useRef<HTMLVideoElement>(null);
  const { start, stop, live } = useDualBroadcast();
  const [loading, setLoading] = useState(false);

  /* 0️⃣ generate (or restore) ONE stable uuid for this browser tab */
  const [uuid] = useState(() => {
    const cached = sessionStorage.getItem(`examUuid-${examId}`);
    if (cached) return cached;
    const id = uuidv4();
    sessionStorage.setItem(`examUuid-${examId}`, id);
    return id;
  });
  /* ── 1 auto-start guard: survives Strict-Mode double mount ──────── */
  const autoStartedRef = useRef(false);            //  <- NEW

  useEffect(() => {
    if (autoStartedRef.current) return;            // already ran once

    const cached = sessionStorage.getItem(`ivsCreds-${uuid}`);
    if (cached) {
      autoStartedRef.current = true;               // mark BEFORE awaiting
      const cfg: IvCreds = JSON.parse(cached);
      start({ ...cfg, preview: videoRef.current! }).catch(console.error);
    }
  }, [uuid, start]);

  /* 2️⃣ first “Start recording” */
  const begin = async () => {
    if (sessionStorage.getItem(`ivsCreds-${uuid}`)) return; // already live

    setLoading(true);
    const res = await fetch('/api/ivs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ examId: uuid }),
    });
    const cfg: IvCreds = await res.json();

    sessionStorage.setItem(`ivsCreds-${uuid}`, JSON.stringify(cfg));
    await start({ ...cfg, preview: videoRef.current! });
    setLoading(false);
  };

  /* 3️⃣ stop & clean up */
  const finish = async () => {
    await stop();
    sessionStorage.removeItem(`ivsCreds-${uuid}`);
    // keep examUuid so a new click starts a *fresh* pair of channels
  };

  return (
    <div className="space-y-4">
      <video ref={videoRef} muted width={320} className="rounded border" />
      {!live && !autoStartedRef.current ? (  
        <button disabled={loading} onClick={begin}>
          {loading ? 'Starting…' : 'Start recording'}
        </button>
      ) : (
        <button onClick={finish}>Stop & submit</button>
      )}
    </div>
  );
}
