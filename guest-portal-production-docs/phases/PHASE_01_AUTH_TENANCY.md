# Phase 01 — Authentication, Authorization and Multi-Tenancy

## Scope

- Organization.
- Property.
- Membership.
- Property assignment.
- Roles.
- Tenant context.
- Staff/Admin login.
- Session.
- RLS bổ sung.
- Audit log nền tảng.

## Acceptance criteria

- User tenant A không đọc/ghi tenant B.
- Property manager chỉ thấy property được gán.
- Admin VI/EN login và navigation.
- Session expiry/revocation.
- Unauthorized API trả lỗi chuẩn.
- Audit log mutation quan trọng.

## Test bắt buộc

- Unit permission matrix.
- Integration tenant isolation.
- E2E login/logout.
- E2E role visibility.
- IDOR test.
- RLS test.
- Locale switch VI/EN.
- Screenshot login, organization switcher, access denied.

## Gate

Bất kỳ tenant leakage nào là S0 và phase FAIL.
