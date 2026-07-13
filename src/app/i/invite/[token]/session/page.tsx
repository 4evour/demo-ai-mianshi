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
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ChatInterface = dynamic(
  () => import("@/components/session/chat-interface").then((m) => m.ChatInterface),
  { ssr: false, loading: () => <PreparingScreen /> },
);
export default function InviteSessionPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();

  const [completed, setCompleted] = useState(false);
  const [completionReason, setCompletionReason] = useState<string | undefined>();
  const [onboardingDone, setOnboardingDone] = useState(false);

  const handleComplete = (reason?: string) => {
    setCompletionReason(reason);
    setCompleted(true);
  };

  const candidate = trpc.candidate.getByToken.useQuery(
    { token },
    { retry: false },
  );

  useEffect(() => {
    if (candidate.isError) {
      router.replace(`/i/invite/${token}`);
    }
    if (candidate.data) {
      const session = (candidate.data as any).session;
      if (!session) {
        router.replace(`/i/invite/${token}`);
      }
    }
  }, [candidate.data, candidate.isError, token, router]);

  if (candidate.isLoading || !candidate.data) {
    return <PreparingScreen />;
  }

  const session = (candidate.data as any).session;
  const interview = (candidate.data as any).interview;

  if (!session) {
    return <PreparingScreen />;
  }

  if (completed || session.status === "COMPLETED") {
    const doneUi = getIntervieweeUi(interview.language);
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
        interviewTitle={interview.title}
        interviewDescription={interview.description}
        questionCount={interview.questions?.length ?? 0}
        timeLimitMinutes={interview.timeLimitMinutes}
        language={interview.language}
        antiCheatingEnabled={MVP_CAPABILITIES.antiCheating}
        voiceEnabled={MVP_CAPABILITIES.voice}
        chatEnabled={MVP_CAPABILITIES.chat}
        aiName={interview.aiName}
        questionTypes={(interview.questions ?? []).map((q: any) => q.type as string)}
        onComplete={() => setOnboardingDone(true)}
      />
    );
  }

  return (
    <>
      <ChatInterface
        sessionId={session.id}
        interview={{
          ...interview,
          questions: interview.questions.map((q: any) => ({
            ...q,
            starterCode: q.starterCode as { language: string; code: string } | null,
          })),
        }}
        durationMinutes={interview.timeLimitMinutes ?? undefined}
        onComplete={handleComplete}
      />
    </>
  );
}
