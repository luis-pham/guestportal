# Design System

## 1. Mục tiêu

Một design system dùng chung nhưng có ba surface:

- Admin
- Staff
- Guest

Admin và Staff dùng chung foundation/component. Guest dùng cùng token nền tảng nhưng component presentation riêng.

## 2. Design tokens

### Color semantic

Không hard-code màu trong component.

- `background`
- `surface`
- `surface-muted`
- `border`
- `text-primary`
- `text-secondary`
- `text-muted`
- `brand`
- `brand-hover`
- `success`
- `warning`
- `danger`
- `info`
- `focus-ring`

Màu brand của từng property chỉ áp dụng Guest Portal và preview; không phá contrast.

### Spacing

Dùng scale cố định:

```text
2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

### Radius

- small: 6
- medium: 10
- large: 14
- xl: 20
- full

### Typography

- Display
- H1
- H2
- H3
- Body
- Body small
- Label
- Caption
- Mono

Admin/Staff mặc định dùng font sans dễ đọc, hỗ trợ tốt tiếng Việt và tiếng Anh.

## 3. Component bắt buộc

### Foundation

- Button
- IconButton
- Link
- Badge
- Avatar
- Tooltip
- Divider
- Spinner
- Skeleton

### Form

- Input
- Textarea
- Select
- Combobox
- Multi-select
- Checkbox
- Radio
- Switch
- Date/time
- File upload
- Form field
- Validation message

### Navigation

- Primary sidebar
- Secondary sidebar
- Breadcrumb
- Tabs
- Command menu
- Pagination
- Bottom navigation
- Mobile drawer

### Feedback

- Toast
- Alert
- Dialog
- Confirm dialog
- Empty state
- Error state
- Inline banner
- Progress

### Data display

- Table
- Data grid
- Card
- Stat
- Timeline
- Activity log
- Key-value list
- Status chip

### Builder

- Canvas frame
- Section palette
- Inspector panel
- Sortable list
- Device preview
- Locale switcher
- Publish status
- Undo/redo

### Conversation

- Message bubble
- Transcript line
- Composer
- Attachment
- Voice control
- Tool action confirmation
- Handoff banner
- Typing state

## 4. Storybook

Bắt buộc có Storybook hoặc equivalent component workbench.

Mỗi component phải có:

- Default.
- Variants.
- Disabled.
- Loading.
- Error nếu có.
- Dark/high contrast nếu hệ thống hỗ trợ.
- Vietnamese long-text example.
- English long-text example.
- Accessibility check.

## 5. Visual regression

Các component và màn hình cốt lõi phải có screenshot test:

- Admin shell.
- Portal Builder.
- Knowledge list.
- Request inbox.
- Order detail.
- Guest homepage.
- Guest chat.
- Staff mobile inbox.

Không chấp nhận thay đổi snapshot hàng loạt mà không review.
