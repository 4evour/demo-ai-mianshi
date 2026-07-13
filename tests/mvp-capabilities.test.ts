import assert from "node:assert/strict";
import test from "node:test";

import {
  MVP_CAPABILITIES,
  normalizeMvpInterviewCapabilities,
} from "@/lib/mvp-capabilities";
import { buildInterviewerPrompt } from "@/lib/ai/prompts/interviewer";

test("MVP only exposes chat interviews", () => {
  assert.deepEqual(MVP_CAPABILITIES, {
    chat: true,
    voice: false,
    video: false,
    antiCheating: false,
  });
});

test("normalizes non-MVP interview capabilities to disabled", () => {
  assert.deepEqual(
    normalizeMvpInterviewCapabilities({
      chatEnabled: false,
      voiceEnabled: true,
      videoEnabled: true,
      antiCheatingEnabled: true,
    }),
    {
      chatEnabled: true,
      voiceEnabled: false,
      videoEnabled: false,
      antiCheatingEnabled: false,
    },
  );
});

test("interviewer prompt stays chat-only for legacy interview records", () => {
  const [system] = buildInterviewerPrompt({
    interview: {
      aiName: "Interviewer",
      title: "Screening",
      objective: "Assess fit",
      aiTone: "PROFESSIONAL",
      language: "en",
      chatEnabled: true,
      voiceEnabled: true,
      videoEnabled: true,
      followUpDepth: "MODERATE",
      questions: [],
    } as never,
    conversationHistory: [],
    currentQuestionIndex: 0,
  });

  assert.match(String(system.content), /- Channels: Chat/);
  assert.doesNotMatch(String(system.content), /Voice|Video/);
});
