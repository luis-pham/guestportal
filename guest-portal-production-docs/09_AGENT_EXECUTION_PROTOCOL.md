# AI Coding Agent Execution Protocol

## 1. Vai trò

AI coding agent phải làm như một kỹ sư chịu trách nhiệm giao sản phẩm thật, không phải người viết báo cáo.

## 2. Trước khi code

Agent phải:

1. Đọc toàn bộ tài liệu bắt buộc.
2. Kiểm tra repository hiện tại.
3. Ghi rõ assumption.
4. Tạo implementation plan cho phase.
5. Xác định test và evidence cần có.
6. Không thay đổi stack nếu chưa có quyết định rõ.

## 3. Trong khi triển khai

- Commit nhỏ, có ý nghĩa.
- Migration có rollback hoặc strategy an toàn.
- Không để TODO trong core flow trừ khi được ghi issue.
- Không hard-code secret.
- Không tạo fake data trong production path.
- Không duplicate domain logic giữa frontend/backend.
- UI phải dùng design system.
- Mọi user-facing text qua i18n.
- Mọi mutation có loading, error và success state.
- Mọi list có loading/empty/error.

## 4. Kết thúc phase

Agent phải tự chạy:

- lint
- typecheck
- unit
- integration
- e2e
- accessibility
- visual regression
- build
- migration check
- security checks phù hợp

Sau đó tạo evidence.

## 5. Gate

Agent chỉ được chuyển phase khi:

- Tất cả acceptance criteria đạt.
- Không còn S0/S1.
- Test command chạy thật.
- Evidence đủ.
- UI được kiểm tra ở viewport yêu cầu.
- `PHASE_RESULT.md` kết luận PASS.

Nếu fail:

- Dừng.
- Sửa.
- Chạy lại.
- Không chuyển phase.

## 6. Mẫu báo cáo bắt buộc

```md
# Phase XX Result

Status: PASS | FAIL | BLOCKED
Commit: <sha>
Environment: <local/staging>

## Completed
...

## Commands executed
...

## Test results
- Unit: 120 passed, 0 failed, 0 skipped
- Integration: ...
- E2E: ...

## UI evidence
- screenshot path...
- viewport...
- locale...

## Known issues
...

## Honest conclusion
...
```

## 7. Quy tắc trung thực

Nếu agent không thể chạy một test do thiếu credential, service hoặc môi trường:

- Ghi `BLOCKED`.
- Nêu dependency thiếu.
- Không suy diễn kết quả.
- Có thể hoàn thành phần khác nhưng không được gọi toàn phase PASS nếu dependency đó thuộc acceptance criteria.
