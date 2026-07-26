# UI Visual Acceptance Standard

## 1. Objective criteria

“Đẹp” không đủ. UI được PASS khi đạt toàn bộ tiêu chuẩn đo được và manual review.

## 2. Layout

- Primary sidebar width: 240 px expanded, 68 px collapsed ± design token.
- Secondary sidebar: 240–280 px.
- Admin page header nhất quán.
- Content padding theo breakpoint.
- Không có unintended horizontal overflow.
- Form content width giới hạn phù hợp, trừ builder/table.
- One primary CTA per page region.

## 3. Typography

- One H1 per page.
- Heading order không nhảy cấp vô lý.
- Body line length hợp lý.
- Không dùng font weight để thay semantic hierarchy duy nhất.
- Vietnamese diacritics render đúng.
- Long EN/VI labels không cắt action quan trọng.

## 4. Interaction

- Minimum pointer target theo accessibility target.
- Visible hover, active, focus, disabled.
- Destructive action phân biệt rõ.
- Async action chống double submit.
- Loading button giữ kích thước.
- Toast không thay thế inline error quan trọng.

## 5. Tables

- Header rõ.
- Sticky header khi danh sách dài.
- Empty state.
- Pagination/cursor state.
- Column alignment.
- Status chip semantic.
- Row action không che nội dung.
- Mobile chuyển card/list hoặc horizontal strategy explicit.

## 6. Builder

- Canvas không nhảy khi chọn section.
- Inspector label rõ.
- Autosave feedback.
- Publish validation.
- Undo/redo enabled state.
- Selection outline.
- Drag placeholder.
- Device preview đúng dimensions tương đối.

## 7. Visual review process

For every phase with UI:

1. Generate screenshots with Playwright.
2. Open screenshots.
3. Create `UI_REVIEW.md`.
4. Record defects:
   - alignment
   - spacing
   - hierarchy
   - truncation
   - contrast
   - responsiveness
   - localization
5. Fix all S1/S2 visual defects.
6. Generate second screenshot set.
7. Compare and sign result.

AI cannot mark UI PASS merely because screenshot files exist.

## 8. Required screenshots

Admin:

- 1024×768
- 1280×800
- 1440×900

Staff:

- 360×800
- 390×844
- 768×1024
- 1280×800

Guest:

- 320×568
- 390×844
- 430×932

Both `vi` and `en` for Admin/Staff critical screens.

## 9. Accessibility gate

- WCAG 2.2 AA target for core flows.
- Zero critical/serious automated violations.
- Keyboard completion of core flow.
- Focus not obscured.
- Error announced/associated.
- Color contrast checked.
