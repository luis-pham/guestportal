# Phase 06.4 UI Review

## Scope

- Guest mobile text chat component.
- Viewports: 320x568, 390x844, 430x932.
- Locales sampled: vi, en, ko.

## Screenshots

- `screenshots/chat-vi-320.png`
- `screenshots/chat-en-390.png`
- `screenshots/chat-ko-430.png`

## Findings

- Header state, transcript, citations, confirmation card, and composer remain visible without overlapping controls.
- Confirmation actions are explicit and separated from draft creation.
- Offline/recovery banner preserves transcript content and exposes retry.
- Vietnamese, English, and Korean labels fit inside mobile controls.
- One visual issue found during review: confirmation card stretched when the recovery banner was absent. Fixed by assigning stable grid rows to header, recovery, transcript, confirmation, and composer.

## Result

PASS
