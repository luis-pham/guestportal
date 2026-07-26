# External Integration Test Standard

## 1. Levels

Every integration must declare:

- Unit mock
- Local emulator/compatible service
- Sandbox/real provider
- Production smoke

Passing a lower level does not imply passing a higher level.

## 2. Cloudflare R2

Required:

- Unit signing tests.
- Local S3-compatible integration.
- Real R2 staging:
  - presign PUT
  - upload
  - HEAD
  - signed GET
  - expiry
  - forbidden wrong key
  - delete/lifecycle behavior
- Public assets domain smoke.

## 3. Gemini Live

Required:

- Token endpoint unit.
- Real ephemeral token.
- Browser direct WebSocket.
- Microphone/audio.
- Tool call.
- Expired token.
- Reconnect.
- Client bundle secret scan.

If real credential absent, integration remains BLOCKED.

## 4. Auth provider

- Login.
- Logout.
- Session refresh.
- Revocation.
- Invite.
- Expired invite.
- Role propagation.
- Cookie settings.

## 5. Managed PostgreSQL

- TLS.
- Pooling.
- Migration.
- RLS.
- Backup.
- Restore.
- Connection limit behavior.

## 6. Evidence labels

Reports must clearly label:

- `MOCK`
- `EMULATED`
- `SANDBOX`
- `REAL_STAGING`
- `PRODUCTION_SMOKE`

Never call emulated test a provider integration PASS.
