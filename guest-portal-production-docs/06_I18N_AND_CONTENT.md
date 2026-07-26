# Internationalization and Content

## 1. Phạm vi

### Admin và Staff

Bắt buộc:

- Tiếng Việt (`vi`)
- Tiếng Anh (`en`)

### Guest

Kiến trúc hỗ trợ nhiều locale. Giai đoạn đầu tối thiểu:

- vi
- en
- ko
- ja
- zh
- fr

## 2. Quy tắc i18n

- Không hard-code user-facing text.
- Dùng message key có namespace.
- Không nối chuỗi dịch.
- Hỗ trợ pluralization.
- Hỗ trợ date/time theo timezone property.
- Hỗ trợ currency theo property.
- Dùng fallback locale.
- Lưu original content và translated content riêng.

## 3. Admin/Staff locale switching

- User chọn locale trong profile.
- Persist trong user preference.
- Server và client render cùng locale.
- Không reload toàn app nếu không cần.
- URL strategy phải được quyết định và thống nhất.

## 4. Guest language detection

Thứ tự:

1. Lựa chọn explicit trong guest session.
2. Browser locale.
3. Ngôn ngữ phát hiện từ text/voice.
4. Property default.
5. Platform fallback.

Không tự đổi ngôn ngữ giữa câu nếu confidence thấp. Khi phát hiện ngôn ngữ mới, có thể hỏi xác nhận nhẹ.

## 5. Knowledge Base đa ngôn ngữ

- Lưu source language.
- Retrieval xuyên ngôn ngữ bằng embedding.
- Gemini trả lời theo guest language.
- Nội dung safety/legal/price phải có bản dịch kiểm duyệt.
- Dynamic translation có cache và version.

## 6. Content quality

Mọi empty state, error, confirmation và destructive action phải có copy chuẩn.

Ví dụ không dùng:

- “Something went wrong” cho mọi lỗi.
- “OK” cho action quan trọng.
- “Delete?” không nói rõ đối tượng.

Phải nói rõ:

- Việc gì xảy ra.
- Dữ liệu nào bị ảnh hưởng.
- Có hoàn tác không.
- User cần làm gì tiếp theo.
