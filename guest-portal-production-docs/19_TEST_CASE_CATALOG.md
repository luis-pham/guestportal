# Test Case Catalog

## 1. Naming

`<surface>.<module>.<scenario>.<expected>`

Example:

`api.request.crossTenantAccess.denied`

## 2. Tenant isolation suite

Fixtures:

- Org A / Hotel A / User A / Guest A
- Org B / Cruise B / User B / Guest B

Required cases:

1. User A cannot list Property B.
2. User A cannot fetch Request B by guessed ID.
3. User A cannot update Order B.
4. Guest A cannot read Guest B conversation.
5. WebSocket A cannot subscribe to property B.
6. RAG query in A never returns chunks from B.
7. Presigned upload key cannot target B prefix.
8. Export cannot include B.
9. Analytics cannot aggregate B.
10. Background job with mismatched tenant/resource fails safely.

## 3. Portal Builder suite

- Create draft.
- Autosave.
- Reload and retain.
- Invalid section blocks publish.
- Publish immutable version.
- Restore old version creates new version.
- Concurrent edit conflict.
- Upload cover failure.
- Locale content fallback.
- Mobile preview.

## 4. QR suite

- Valid token.
- Disabled token.
- Unknown token.
- Rate limit.
- Token does not contain internal IDs.
- Location context correct.
- Reassigned destination reflects without reprint.
- Property suspended.

## 5. Knowledge/RAG suite

Dataset:

- Vietnamese source.
- English, Korean, Japanese queries.
- Similar names.
- Misspelled entity names.
- Conflicting source versions.
- Prompt injection text.

Metrics:

- Recall@k on labeled set.
- Correct tenant rate: 100%.
- Citation source correctness.
- No-result behavior.
- Latency distribution.

## 6. Request/order suite

- Valid transitions.
- Invalid transitions.
- Duplicate confirmation.
- Concurrent staff claim.
- Cancellation rules.
- Price snapshot.
- Realtime duplicate.
- Reconnect and resync.
- Audit history.
- Guest status visibility.

## 7. Voice suite

- Ephemeral token issued only to valid guest session.
- Token expiry.
- API key absent from JS bundle.
- Microphone denied.
- Network disconnect.
- Reconnect.
- Voice knowledge query.
- Voice tool draft.
- Guest confirmation.
- Duplicate tool result.
- Text fallback.

## 8. UI suite

For every critical screen:

- vi locale.
- en locale.
- Long content.
- Empty.
- Loading.
- Error.
- Permission denied.
- 1024/1280/1440 Admin.
- 360/390/768 Staff.
- 320/390/430 Guest.
- Keyboard.
- axe.
- Screenshot diff.

## 9. Production readiness

- Migration from previous schema.
- Backup restore.
- Worker crash recovery.
- Redis restart.
- WebSocket restart.
- Expired signed URL.
- R2 unavailable simulation.
- Gemini unavailable fallback.
- Database connection saturation alert.
