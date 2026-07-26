# Security and Privacy

## 1. Threat model chính

- Tenant data leakage.
- QR token guessing.
- Guest session hijacking.
- Unauthorized staff access.
- Malicious file upload.
- Prompt injection từ KB.
- Gemini tool call abuse.
- Replay request/order.
- R2 object exposure.
- Secret leakage.
- WebSocket authorization bypass.

## 2. Authentication

### Staff/Admin

- OIDC/Supabase Auth.
- Secure HttpOnly cookie.
- CSRF protection phù hợp.
- Session rotation.
- MFA-ready.
- Password policy nếu dùng password.

### Guest

- Opaque QR token.
- Signed guest session cookie/token.
- Session expiry.
- Location binding.
- Rate limit.

## 3. Authorization

- RBAC + tenant scope.
- Backend xác định tenant.
- Không tin organization/property ID từ client.
- Object-level authorization.
- Audit log.

## 4. Gemini

- Không đưa API key chính xuống browser.
- Chỉ ephemeral token.
- Token scope và TTL ngắn.
- Tool gateway validate mọi input.
- AI không quyết định authorization.
- Mutation cần confirmation.
- Tool result không trả dữ liệu vượt scope.

## 5. R2

- Bucket production private mặc định.
- Public assets qua domain riêng.
- Private files dùng signed URL.
- Presigned upload giới hạn key, size, mime, expiry.
- Validate magic bytes.
- Quota tenant.
- Lifecycle cleanup.
- Không lưu credential trong URL log.

## 6. Knowledge security

- Parse file trong worker cô lập.
- Sanitize HTML.
- Không thực thi macro/script.
- Prompt injection defense:
  - Source content chỉ là dữ liệu, không phải instruction.
  - System/tool policy ưu tiên cao hơn.
  - Không cho KB tự yêu cầu tool nhạy cảm.
- Citation source.
- Version và checksum.

## 7. Privacy

- Không lưu raw audio mặc định.
- Transcript opt-in theo property.
- Retention rõ.
- Guest attachment retention.
- Data export/delete workflow.
- Không dùng dữ liệu tenant A huấn luyện hoặc trả lời tenant B.

## 8. Security tests

- IDOR.
- Tenant isolation.
- Rate limit.
- Auth bypass.
- Signed URL expiry.
- Upload content validation.
- XSS.
- CSRF.
- SQL injection.
- Prompt injection.
- Tool abuse.
- WebSocket channel isolation.
