export const MVP_CAPABILITIES = {
  chat: true,
  voice: false,
  video: false,
  antiCheating: false,
} as const;

export function normalizeMvpInterviewCapabilities(input: {
  chatEnabled?: boolean;
  voiceEnabled?: boolean;
  videoEnabled?: boolean;
  antiCheatingEnabled?: boolean;
}) {
  return {
    chatEnabled: MVP_CAPABILITIES.chat,
    voiceEnabled: MVP_CAPABILITIES.voice,
    videoEnabled: MVP_CAPABILITIES.video,
    antiCheatingEnabled: MVP_CAPABILITIES.antiCheating,
  };
}
