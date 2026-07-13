"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { IntervieweeOnboarding } from "@/components/session/interviewee-onboarding";
import { PreparingScreen } from "@/components/session/preparing-screen";
import { Card, CardContent } from "@/components/ui/card";
import { getIntervieweeUi } from "@/lib/i18n/interviewee-ui";
import { MVP_CAPABILITIES } from "@/lib/mvp-capabilities";
import { trpc } from "@/lib/trpc/client";
import { CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "aural_session_";

const ChatInterface = dynamic(
  () => import("@/components/session/chat-interface").then((m) => m.ChatInterface),
  { ssr: false, loading: () => <PreparingScreen /> },
);
export default function SlugSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const sidParam = searchParams.get("sid");
  const isPreview = searchParams.get("preview") === "true";

  const [completed, setCompleted] = useState(false);
  const [completionReason, setCompletionReason] = useState<string | undefined>();
  const [onboardingDone, setOnboardingDone] = useState(isPreview);

  const handleComplete = (reason?: string) => {
    setCompletionReason(reason);
    setCompleted(true);
  };

  const sessionId = useMemo(() => {
    if (sidParam) return sidParam;
    try { return localStorage.getItem(STORAGE_PREFIX + slug); } catch { return null; }
  }, [sidParam, slug]);

  const interview = trpc.interview.getBySlug.useQuery({ slug }, { retry: false });
  const session = trpc.session.getById.useQuery(
    { id: sessionId! },
    { enabled: !!sessionId, retry: false },
  );

  useEffect(() => {
    if (!sessionId || session.isError) {
      router.replace(`/i/${slug}`);
    }
  }, [sessionId, session.isError, slug, router]);


  if (interview.isLoading || session.isLoading || !interview.data || !session.data) {
    return <PreparingScreen />;
  }

  if (session.data.status === "COMPLETED" || completed) {
    const doneUi = getIntervieweeUi(interview.data?.language);
    try { localStorage.removeItem(STORAGE_PREFIX + slug); } catch { /* noop */ }
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-secondary-500" />
            <h2 className="mt-4 text-2xl font-bold">{doneUi.thankYou}</h2>
            {completionReason === "TIME_LIMIT_EXCEEDED" && (
              <p className="mt-2 text-sm text-amber-600">
                {doneUi.timeLimitEnded}
              </p>
            )}
            <p className="mt-2 text-muted-foreground">{doneUi.completedBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!onboardingDone) {
    return (
      <IntervieweeOnboarding
        interviewTitle={interview.data.title}
        interviewDescription={interview.data.description}
        questionCount={interview.data.questions.length}
        timeLimitMinutes={interview.data.timeLimitMinutes}
        language={interview.data.language}
        voiceEnabled={MVP_CAPABILITIES.voice}
        chatEnabled={MVP_CAPABILITIES.chat}
        aiName={interview.data.aiName}
        questionTypes={interview.data.questions.map((q: any) => q.type as string)}
        onComplete={() => setOnboardingDone(true)}
      />
    );
  }

  // Derive resume state
  const resumeMessages = session.data.messages;
  const resumeQuestionIndex = (() => {
    const { currentQuestionId } = session.data;
    if (currentQuestionId) {
      const idx = interview.data.questions.findIndex((q: any) => q.id === currentQuestionId);
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  const isResuming = resumeMessages && resumeMessages.length > 0;

  return (
    <>
      <ChatInterface
        sessionId={sessionId!}
        interview={{
          ...interview.data,
          questions: interview.data.questions.map((q: any) => ({
            ...q,
            starterCode: q.starterCode as { language: string; code: string } | null,
          })),
        }}
        durationMinutes={interview.data.timeLimitMinutes ?? undefined}
        initialMessages={resumeMessages
          ?.filter((m: any) => m.contentType !== "WHITEBOARD")
          .map((m: any) => ({
            id: m.id,
            role: m.role as "USER" | "ASSISTANT" | "SYSTEM",
            content: m.content,
            timestamp: m.timestamp.toString(),
          }))}
        initialQuestionIndex={isResuming ? resumeQuestionIndex : undefined}
        onComplete={handleComplete}
      />
    </>
  );
}
