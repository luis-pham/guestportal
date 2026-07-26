# Product Requirements Document

## 1. Tầm nhìn sản phẩm

Xây dựng nền tảng Guest Portal có thương hiệu riêng cho từng cơ sở lưu trú hoặc dịch vụ. Khách truy cập qua QR/NFC, không cần cài app, có thể tìm thông tin, chat bằng text hoặc voice, đặt dịch vụ, gửi yêu cầu và theo dõi tiến độ.

## 2. Vai trò người dùng

### 2.1 Guest

- Truy cập ẩn danh bằng QR.
- Xem portal đúng property và location.
- Dùng text chat hoặc voice chat.
- Xem digital guide.
- Order sản phẩm/dịch vụ.
- Tạo request.
- Theo dõi request/order.
- Chat với staff.
- Chọn hoặc tự động nhận diện ngôn ngữ.

### 2.2 Organization Owner/Admin

- Quản lý organization.
- Quản lý nhiều property.
- Cấu hình branding và portal.
- Quản lý KB, catalog, staff và analytics.
- Quản lý quyền truy cập.

### 2.3 Property Manager

- Quản lý một hoặc nhiều property được gán.
- Quản lý portal, QR, KB, request, order và staff trong scope.

### 2.4 Staff

- Xem inbox.
- Nhận request/order.
- Chat với guest.
- Cập nhật trạng thái.
- Xác nhận hoàn thành.
- Xem lịch sử xử lý thuộc property được phân quyền.

## 3. Module chức năng

### 3.1 Organization & Property

- Organization có nhiều property.
- Property có type: hotel, resort, cruise, airbnb, serviced_apartment, restaurant, spa, other.
- Property có timezone, currency, locales, branding, operating hours.
- Property có location/unit như room, cabin, villa, table, area, deck, spa room.

### 3.2 Portal Builder

- Cover.
- Logo.
- Màu thương hiệu.
- Typography preset.
- Lời chào.
- Assistant name/avatar.
- Section và thứ tự section.
- Quick actions.
- Navigation.
- Preview desktop/mobile.
- Preview theo locale và location.
- Draft/published version.
- Rollback phiên bản trước.

### 3.3 QR Management

- QR opaque token.
- Gắn với property/location/destination.
- Disable/enable.
- Regenerate token.
- Download PNG/SVG.
- Theo dõi scan count.
- Không encode ID nhạy cảm.

### 3.4 Knowledge Base

- Upload PDF/DOCX/TXT/HTML.
- Nhập nội dung trực tiếp.
- Crawl URL được cho phép.
- Detect language.
- Chunking.
- Embedding.
- Versioning.
- Publish/unpublish.
- Test retrieval.
- Xem source citation.
- Xem câu hỏi chưa trả lời tốt.

### 3.5 Catalog

- Category.
- Product.
- Service.
- Variant.
- Add-on.
- Availability.
- Price.
- Currency.
- Time slot.
- Fulfillment location.
- Inventory mode đơn giản.
- Visibility theo property/location.

### 3.6 Request

- Draft.
- Submitted.
- Accepted.
- In progress.
- Completed.
- Rejected.
- Cancelled.
- Chat thread.
- Attachments.
- Idempotency.
- Audit history.

### 3.7 Order

- Cart.
- Draft.
- Submitted.
- Confirmed.
- Preparing.
- Ready.
- Delivering.
- Completed.
- Cancelled.
- Price snapshot.
- Item snapshot.
- Notes.
- Payment mode: room charge, pay_on_delivery, pay_at_counter, external_link.

### 3.8 Conversation

- Text và voice dùng chung conversation.
- AI, guest, staff, system và tool messages.
- Handoff từ AI sang staff.
- Translation.
- Transcript retention có cấu hình.
- Không mặc định lưu raw audio.

### 3.9 Staff Workspace

- Inbox tổng hợp.
- Bộ lọc theo trạng thái, loại, property.
- Claim request/order.
- Chat.
- Quick status action.
- Search.
- Realtime update.
- Notification.
- Mobile-first PWA.

### 3.10 Analytics cơ bản

- QR scans.
- Guest sessions.
- Chat sessions.
- Request count.
- Order count/value.
- Response time.
- Completion time.
- Popular services.
- Retrieval no-result rate.
- Voice usage.

## 4. Ngoài phạm vi MVP

- PMS integration sâu.
- OTA sync.
- Digital key.
- Native mobile app.
- POS đầy đủ.
- Housekeeping software đầy đủ.
- Complex workflow engine.
- Loyalty.
- CRM.
- Multi-region active-active.
- Full data warehouse.

## 5. Yêu cầu phi chức năng

- P95 API read < 500 ms với request thông thường.
- Guest initial page usable dưới 3 giây trên mạng 4G trung bình.
- Không rò rỉ tenant.
- Có audit log cho hành động admin/staff quan trọng.
- Realtime reconnect được.
- Worker job idempotent.
- R2 upload trực tiếp bằng presigned URL.
- Build reproducible.
- Backup và restore được kiểm thử.
