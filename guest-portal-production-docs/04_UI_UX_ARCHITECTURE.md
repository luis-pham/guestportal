# UI/UX Architecture

## 1. Mục tiêu trải nghiệm

Admin và Staff phải có cảm giác của một SaaS hiện đại:

- Cấu trúc rõ như Canva/Notion/Linear.
- Sidebar trái cố định.
- Sidebar cấp một mở ra nhóm chức năng.
- Khi chọn module, có sidebar cấp hai hoặc panel điều hướng ngữ cảnh.
- Khu vực làm việc chính rộng, sạch.
- Header ngữ cảnh có breadcrumb, search, action.
- Không nhồi toàn bộ menu vào một cột.
- Desktop-first cho Admin.
- Mobile-first cho Staff.
- Guest Portal mobile-first hoàn toàn.

## 2. App shell Admin

```text
┌─────────────┬────────────────────┬──────────────────────────┐
│ Primary Nav │ Secondary Nav      │ Workspace                │
│             │                    │                          │
│ Logo        │ Module title       │ Breadcrumb               │
│ Home        │ Search/filter      │ Page title + actions     │
│ Portal      │ Section list       │ Main content             │
│ Knowledge   │                    │                          │
│ Catalog     │                    │                          │
│ Operations  │                    │                          │
│ Analytics   │                    │                          │
│ Settings    │                    │                          │
└─────────────┴────────────────────┴──────────────────────────┘
```

### Primary sidebar

- Width expanded: 232–256 px.
- Width collapsed: 64–72 px.
- Có logo, workspace switcher, main navigation, help, profile.
- Icon + label.
- Active state rõ.
- Có tooltip khi collapsed.

### Secondary sidebar

Dùng khi module có nhiều nhóm con.

Ví dụ Portal:

- Overview
- Branding
- Navigation
- Homepage
- Pages
- Quick actions
- Preview
- Publish history

Ví dụ Knowledge:

- Sources
- Articles
- Processing
- Search test
- Missing answers
- Settings

Có thể thu gọn ở màn hình nhỏ.

### Workspace

- Max width phù hợp từng màn hình.
- List/table có full width.
- Form editor có split view.
- Portal Builder có canvas + inspector.
- Empty state có hướng dẫn rõ.
- Page action luôn ở vị trí nhất quán.

## 3. Portal Builder giống công cụ thiết kế SaaS

```text
┌────────────┬──────────────────────────┬─────────────────────┐
│ Components │ Canvas / Phone Preview   │ Inspector           │
│            │                          │                     │
│ Sections   │ Live portal preview      │ Content             │
│ Blocks     │                          │ Style               │
│ Templates  │                          │ Visibility          │
│            │                          │ Localization        │
└────────────┴──────────────────────────┴─────────────────────┘
```

Yêu cầu:

- Drag-and-drop section.
- Add/remove/reorder.
- Select section trên canvas.
- Inspector thay đổi content/style.
- Undo/redo.
- Draft autosave.
- Explicit Publish.
- Preview locale/location/device.
- Version history.
- Unsaved changes guard.
- Keyboard accessible ở mức phù hợp.

Không xây tự do như Figma. Chỉ cho cấu hình trong design constraints để đảm bảo đẹp.

## 4. Staff Workspace

### Desktop/tablet

- Sidebar nhỏ.
- Inbox list bên trái.
- Detail panel bên phải.
- Chat và status action cùng màn hình.
- Không phải chuyển trang nhiều.

### Mobile

- Bottom navigation:
  - Inbox
  - My work
  - Messages
  - More
- Card lớn.
- Nút trạng thái dễ bấm.
- Filter drawer.
- Pull-to-refresh hoặc explicit refresh.
- Offline/reconnect status rõ.
- Hỗ trợ tiếng Việt và tiếng Anh.

## 5. Guest Portal

- Hero cover.
- Logo chồng một phần trên cover nếu template chọn.
- Greeting.
- Quick actions.
- Explore.
- Services.
- Schedule.
- Guide.
- Bottom navigation.
- Floating assistant button.
- Text và voice chat trong unified sheet/page.
- Status center cho request/order.
- Không hiển thị UI quản trị.
- Không yêu cầu login.

## 6. Responsive breakpoints

- Mobile: 320–767 px.
- Tablet: 768–1023 px.
- Desktop: 1024–1439 px.
- Large desktop: từ 1440 px.

Admin phải usable tối thiểu từ 1024 px. Staff phải usable từ 360 px. Guest phải usable từ 320 px.

## 7. UX states bắt buộc

Mọi màn hình dữ liệu phải có:

- Loading.
- Skeleton.
- Empty.
- Error.
- Permission denied.
- Offline/reconnecting nếu realtime.
- Success feedback.
- Destructive confirmation.
- Unsaved changes.
- Partial failure nếu batch action.

## 8. Accessibility

Mục tiêu WCAG 2.2 AA cho Admin và Staff ở các flow chính.

Bắt buộc:

- Keyboard navigation.
- Visible focus.
- Label form.
- Error association.
- Contrast.
- Semantic heading.
- ARIA chỉ khi cần.
- Screen reader name cho icon button.
- Không chỉ dùng màu để truyền trạng thái.
