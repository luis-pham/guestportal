# Production-Ready QR Guest Portal — Implementation Documentation Pack

## 1. Mục đích

Bộ tài liệu này là nguồn yêu cầu chuẩn để một AI coding agent hoặc đội phát triển triển khai toàn bộ nền tảng QR Guest Portal cho:

- Khách sạn
- Resort
- Du thuyền
- Airbnb và vacation rental
- Căn hộ dịch vụ
- Nhà hàng, bar, spa và các dịch vụ liên quan

Hệ thống gồm ba ứng dụng chính:

1. **Guest Portal**: khách quét QR, xem nội dung, chat text/voice, gửi request, order và theo dõi trạng thái.
2. **Admin Portal**: quản trị organization, property, portal, branding, Knowledge Base, catalog, staff, request, order và báo cáo.
3. **Staff Workspace**: nhân viên nhận request/order, chat, cập nhật trạng thái và xác nhận hoàn thành.

## 2. Nguyên tắc triển khai

- Production-ready, không làm demo giả.
- Multi-tenant ngay từ đầu.
- Modular monolith, có boundary rõ để tách service sau.
- UI/UX hoàn thiện, hiện đại, nhất quán.
- Admin và Staff hỗ trợ tiếng Việt và tiếng Anh.
- Guest Portal hỗ trợ đa ngôn ngữ và nhận diện ngôn ngữ tự động.
- Voice kết nối trực tiếp từ browser tới Gemini Live bằng ephemeral token.
- Knowledge Base lưu ngôn ngữ gốc nhưng truy xuất và trả lời đa ngôn ngữ.
- Embedding dùng EmbeddingGemma 300M/308M, vector 768 chiều.
- Object storage dùng Cloudflare R2.
- Không được chuyển phase nếu phase hiện tại chưa có bằng chứng PASS thực tế.

## 3. Thứ tự đọc tài liệu

1. `01_PRODUCT_REQUIREMENTS.md`
2. `02_SYSTEM_ARCHITECTURE.md`
3. `03_DOMAIN_AND_DATA_MODEL.md`
4. `04_UI_UX_ARCHITECTURE.md`
5. `05_DESIGN_SYSTEM.md`
6. `06_I18N_AND_CONTENT.md`
7. `07_SECURITY_PRIVACY.md`
8. `08_TESTING_AND_EVIDENCE.md`
9. `09_AGENT_EXECUTION_PROTOCOL.md`
10. `10_DEPLOYMENT_AND_OPERATIONS.md`
11. Các file trong thư mục `phases/`

## 4. Cổng nghiệm thu bắt buộc

Mỗi phase phải tạo đủ:

- Source code thực tế.
- Migration và schema thực tế nếu có.
- Unit test.
- Integration test.
- End-to-end test phù hợp.
- Screenshot UI ở kích thước chuẩn.
- Báo cáo accessibility.
- Log build và test.
- Danh sách lỗi còn lại.
- File `PHASE_RESULT.md` có liên kết tới bằng chứng.

Nếu không có bằng chứng, trạng thái mặc định là **FAIL**.

## 5. Quy tắc cấm

AI coding agent không được:

- Tự tuyên bố PASS khi chưa chạy test.
- Bỏ qua test vì “đã kiểm tra bằng mắt”.
- Dùng mock thay cho luồng production mà không ghi rõ.
- Tạo UI placeholder rồi báo hoàn thiện.
- Giả lập kết quả command.
- Bịa screenshot, log hoặc test result.
- Chuyển phase khi còn lỗi Severity 0 hoặc Severity 1.
- Âm thầm thay đổi scope, stack hoặc data model.
- Đưa secret vào source code.
- Đưa API key Gemini xuống browser.
- Dùng dữ liệu tenant này để trả lời tenant khác.

## 6. Trạng thái phase

Chỉ dùng bốn trạng thái:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `PASS`

Không dùng `MOSTLY_DONE`, `NEARLY_PASS`, `CONDITIONAL_PASS` trừ khi tài liệu phase cho phép rõ ràng.

## 7. Implementation specification bổ sung trong v2

- `13_ROUTE_AND_NAVIGATION_MAP.md`
- `14_SCREEN_SPECIFICATIONS.md`
- `15_API_CONTRACTS.md`
- `16_DATABASE_SCHEMA_SPECIFICATION.md`
- `17_PERMISSION_MATRIX.md`
- `18_EVENT_AND_JOB_CATALOG.md`
- `19_TEST_CASE_CATALOG.md`
- `20_FIXTURE_AND_DEMO_DATA.md`
- `21_UI_VISUAL_ACCEPTANCE_STANDARD.md`
- `22_AUTOMATED_PHASE_GATE.md`
- `23_COMPONENT_AND_FORM_CATALOG.md`
- `24_EXTERNAL_INTEGRATION_TEST_STANDARD.md`
- `25_DECISION_LOG_AND_CHANGE_CONTROL.md`
- `26_PHASE_PROMPT_TEMPLATE.md`


Các tài liệu v2 khóa route, screen, API, database, permission, events, test cases, fixtures, UI acceptance và phase gate tự động. Khi có xung đột, tài liệu có số lớn hơn và cụ thể hơn được ưu tiên, trừ khi ADR mới thay đổi quyết định.


## Execution layer (added after Phase 01)

The roadmap remains 11 phases. Phase 01 is treated as an inherited baseline. Before continuing, coding agents must use the task-oriented execution layer under `execution/`.

Start with:

1. `execution/00_EXECUTION_README.md`
2. `execution/01_PHASE_01_BASELINE_AND_TRANSITION.md`
3. `execution/08_TASK_MANIFEST_INDEX.md`
4. `execution/PHASE_02_EXECUTION_PLAN.md`
5. `execution/tasks/02.1_design_tokens_and_theme_foundation.md`

Use `execution/06_TASK_PROMPT_TEMPLATE.md` to invoke exactly one task at a time.


## Reserved architecture layer (required before Phase 02)

The roadmap remains unchanged. Read `reserved/00_RESERVED_ARCHITECTURE.md` before executing Task 02.1. Platform Admin, commercial plans, subscriptions, billing and payment integration are intentionally deferred. Current phases must preserve boundaries without guessing or scaffolding those business modules.
