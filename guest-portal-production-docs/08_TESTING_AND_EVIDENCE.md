# Testing and Evidence Standard

## 1. Mục tiêu

Không có phase nào được PASS chỉ bằng mô tả. PASS phải dựa trên bằng chứng có thể kiểm tra lại.

## 2. Test pyramid

### Unit

- Domain rules.
- State transition.
- Validation.
- Permission.
- Price calculation.
- Locale behavior.
- Tool payload.

### Integration

- PostgreSQL.
- Redis.
- BullMQ.
- R2-compatible test storage.
- Embedding service.
- API repositories.
- WebSocket events.

### End-to-end

- Browser thực.
- Guest, Admin, Staff flow.
- Multi-tenant.
- Locale.
- Responsive.
- Error states.

### Visual regression

- Screenshot chuẩn.
- Review diff.
- Không auto-accept.

### Accessibility

- axe.
- Keyboard flow.
- Focus.
- Labels.
- Contrast.
- Screen reader smoke test ở flow chính.

### Performance

- Lighthouse Guest Portal.
- API load test.
- WebSocket concurrency smoke.
- Worker throughput.
- RAG latency.
- Voice connection latency đo thực tế khi credential tồn tại.

## 3. Evidence bắt buộc

Mỗi phase phải tạo thư mục:

```text
evidence/phase-XX/
  commands/
  logs/
  screenshots/
  videos/
  reports/
  fixtures/
  PHASE_RESULT.md
```

### `PHASE_RESULT.md`

Phải ghi:

- Commit SHA.
- Environment.
- Command đã chạy.
- Test count.
- Passed/failed/skipped.
- Screenshot paths.
- Known issues.
- Scope đã hoàn thành.
- Scope chưa hoàn thành.
- Kết luận PASS hoặc FAIL.

## 4. Quy tắc chống báo cáo láo

- Không được viết “test passed” nếu command chưa chạy.
- Mọi command phải lưu output.
- Không xóa failing test để đạt PASS.
- Skipped test phải có lý do và owner.
- Không mock integration production rồi gọi là integration PASS.
- Không dùng screenshot từ phase cũ.
- Screenshot phải chứa build/version hoặc timestamp test context khi phù hợp.
- Nếu credential bên ngoài thiếu, phase chỉ PASS phần nội bộ; integration đó phải `BLOCKED`, không được giả PASS.
- Báo cáo phải nêu chính xác lỗi.

## 5. Severity

- S0: Security/data loss/tenant leakage.
- S1: Core flow broken.
- S2: Major UX or non-core function broken.
- S3: Minor visual/copy issue.

Không được PASS khi còn S0/S1.
S2 chỉ được defer nếu phase document cho phép và có issue rõ.
