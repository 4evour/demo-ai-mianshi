import assert from "node:assert/strict";
import test from "node:test";

import {
  MVP_CAPABILITIES,
  normalizeMvpInterviewCapabilities,
} from "@/lib/mvp-capabilities";

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
