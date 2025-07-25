'use client';
import { useRef, useState } from 'react';
import { useDualBroadcast } from '@/hooks/useDualBroadcast';

export default function ExamRecorder({ examId }: { examId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { start, stop, live } = useDualBroadcast();
  const [loading, setLoading] = useState(false);

  const begin = async () => {
    setLoading(true);
    const res = await fetch('/api/ivs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ examId }),
    });
    const cfg = await res.json();
    await start({ ...cfg, preview: videoRef.current! });
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <video ref={videoRef} muted width={320} />
      {!live ? (
        <button disabled={loading} onClick={begin}>
          {loading ? 'Starting…' : 'Start recording'}
        </button>
      ) : (
        <button onClick={stop}>Stop & submit</button>
      )}
    </div>
  );
}
