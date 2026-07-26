# Phase 02 — Design System and SaaS App Shell

## Scope

- Design tokens.
- Component library.
- Storybook.
- Admin primary/secondary sidebar.
- Staff shell desktop/mobile.
- Header, breadcrumb, command menu.
- i18n VI/EN.
- Loading/empty/error patterns.
- Responsive behavior.

## UX mục tiêu

Phong cách hiện đại giống Canva/Notion:

- Primary sidebar bên trái.
- Secondary contextual sidebar.
- Workspace rõ.
- Page title và actions nhất quán.
- Không clone thương hiệu Canva.

## Acceptance criteria

- Component states đủ.
- Admin shell hoạt động 1024, 1280, 1440.
- Staff hoạt động 360, 390, 768, 1280.
- Keyboard navigation cơ bản.
- Contrast AA.
- Không overflow text tiếng Việt/Anh.
- Collapsed sidebar hoạt động.

## Test bắt buộc

- Storybook interaction.
- axe.
- Keyboard.
- Screenshot visual regression.
- Responsive E2E.
- Long translation test.
- Focus order.

## Gate

Không chuyển nếu app shell còn placeholder hoặc inconsistency lớn.
