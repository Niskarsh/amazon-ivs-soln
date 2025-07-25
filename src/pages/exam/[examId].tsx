// src/pages/exam/[examId].tsx   (pages router)
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// client‑only recorder
const ExamRecorder = dynamic(() => import('@/components/ExamRecorder'), {
  ssr: false,
});

export default function ExamPage() {
  const { query } = useRouter();
  const examId = query.examId as string | undefined;   // ← typed, no 'any'

  if (!examId) return null;                            // router not ready

  return (
    <main style={{ padding: 24 }}>
      <h2>Exam {examId}</h2>
      <ExamRecorder examId={examId} />
    </main>
  );
}
