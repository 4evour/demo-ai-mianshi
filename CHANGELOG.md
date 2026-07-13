# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Product requirements and MVP technical design for AI candidate screening and project authenticity verification.
- ADR-001 documenting the decision to extend the upstream interview platform instead of rebuilding the Web application from scratch.
- Original take-home assignment under `docs/requirements/` for requirement traceability.

### Changed

- Added a single MVP capability policy that forces chat-only interviews and disables voice, video, and anti-cheating fields at the server boundary.
- Added regression coverage for MVP capability normalization.
- Removed non-MVP voice, video, and anti-cheating controls from interview creation and settings screens.
- Forced legacy sessions and interviewer prompts to use chat mode.
- Removed voice relay startup, Docker service wiring, voice relay build arguments, and voice-only default tests from the MVP runtime path.
- Hid multi-organization switching and organization/member management entry points from the MVP navigation while retaining existing data and permission services.
- Removed practice mode and standalone AI chat from the MVP default navigation while retaining their routes for later phases.
- Removed the duplicate public favicon that conflicted with the App Router favicon and caused `/favicon.ico` to return HTTP 500 in local development.
- Added standard autocomplete attributes to login and registration fields for cleaner browser validation.
- Disabled self-service registration for the MVP: registration links now point to login, `/register` redirects to `/login`, and onboarding copy references administrator-provided accounts.

## [0.2.0] - 2026-05-24

### Added

- Interview practice mode with voice coaching and relay improvements.
- JD/Resume upload to customize AI interview generation.
- Private chat session UI: floating composer, progress header, and resizable whiteboard/code side panels.
- Chunk-load recovery hook for Monaco and Excalidraw lazy bundles.

### Changed

- Chat-only onboarding skips the interviewee product tour.
- Question navigation uses internal system messages and manual-navigation handling in the chat API.

### Fixed

- Chat-only mode question UI stays in sync with the conversation.

## [0.1.0] - 2026-03-16

### Added

- Initial open-source release of the Aural AI interview platform.
- Voice, chat, and video interview modes.
- Live coding (Monaco) and whiteboard (Excalidraw) support.
- Automated AI scoring reports and anti-cheating safeguards.
- Team management, multilingual UI, and pluggable LLM providers.
- Self-hosted deployment with Docker, Supabase, and Node.js.

[0.2.0]: https://github.com/1146345502/aural-oss/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/1146345502/aural-oss/releases/tag/v0.1.0
