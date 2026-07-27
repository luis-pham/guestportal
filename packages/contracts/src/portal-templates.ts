import type { PortalConfigDocument } from './portal.js';
import { emptyLocalized } from './portal.js';

function id(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Built-in portal templates keyed by property type. */
export const PORTAL_TEMPLATE_SEEDS: Array<{
  id: string;
  propertyType: string;
  name: string;
  config: PortalConfigDocument;
}> = [
  {
    id: 'hotel_default',
    propertyType: 'hotel',
    name: 'Hotel default',
    config: {
      schemaVersion: 1,
      templateId: 'hotel_default',
      greeting: emptyLocalized('Xin chào quý khách', 'Welcome, guest'),
      assistant: {
        name: emptyLocalized('Trợ lý khách sạn', 'Hotel assistant'),
        avatarAssetId: null,
      },
      primaryNavigation: [
        {
          id: id(1),
          label: emptyLocalized('Trang chủ', 'Home'),
          href: '/',
          visible: true,
        },
        {
          id: id(2),
          label: emptyLocalized('Dịch vụ', 'Services'),
          href: '/services',
          visible: true,
        },
        {
          id: id(3),
          label: emptyLocalized('Hướng dẫn', 'Guide'),
          href: '/guide',
          visible: true,
        },
      ],
      secondaryNavigation: [
        {
          id: id(4),
          label: emptyLocalized('Trợ giúp', 'Help'),
          href: '/help',
          visible: true,
        },
      ],
      sections: [
        {
          id: id(10),
          type: 'hero',
          enabled: true,
          title: emptyLocalized('Chào mừng đến khách sạn', 'Welcome to the hotel'),
          subtitle: emptyLocalized(
            'Khám phá dịch vụ và tiện nghi dành cho bạn',
            'Discover services and amenities for your stay',
          ),
          ctaLabel: emptyLocalized('Bắt đầu', 'Get started'),
          ctaHref: '#assistant',
        },
        {
          id: id(11),
          type: 'quick_actions',
          enabled: true,
          title: emptyLocalized('Thao tác nhanh', 'Quick actions'),
          actions: [
            {
              id: id(111),
              label: emptyLocalized('Dọn phòng', 'Housekeeping'),
              href: '/requests/housekeeping',
              icon: 'bell',
            },
            {
              id: id(112),
              label: emptyLocalized('Đặt đồ ăn', 'Order food'),
              href: '/food',
              icon: 'food',
            },
            {
              id: id(113),
              label: emptyLocalized('Chat', 'Chat'),
              href: '/chat',
              icon: 'chat',
            },
          ],
        },
        {
          id: id(12),
          type: 'explore_collections',
          enabled: true,
          title: emptyLocalized('Khám phá', 'Explore'),
          collectionKeys: ['dining', 'spa', 'experiences'],
        },
        {
          id: id(13),
          type: 'featured_services',
          enabled: true,
          title: emptyLocalized('Dịch vụ nổi bật', 'Featured services'),
          serviceIds: [],
        },
        {
          id: id(14),
          type: 'schedule',
          enabled: true,
          title: emptyLocalized('Lịch hôm nay', 'Today schedule'),
          items: [
            {
              id: id(141),
              label: emptyLocalized('Buffet sáng', 'Breakfast buffet'),
              timeLabel: emptyLocalized('06:30–10:00', '06:30–10:00'),
            },
          ],
        },
        {
          id: id(15),
          type: 'guide_links',
          enabled: true,
          title: emptyLocalized('Hướng dẫn', 'Guides'),
          links: [
            {
              id: id(151),
              label: emptyLocalized('Wi‑Fi', 'Wi‑Fi'),
              href: '/guide/wifi',
            },
          ],
        },
        {
          id: id(16),
          type: 'promotion_banner',
          enabled: true,
          title: emptyLocalized('Ưu đãi', 'Offer'),
          body: emptyLocalized('Giảm 10% spa hôm nay', '10% off spa today'),
          href: '/spa',
        },
        {
          id: id(17),
          type: 'assistant_callout',
          enabled: true,
          title: emptyLocalized('Hỏi trợ lý', 'Ask the assistant'),
          body: emptyLocalized(
            'Đặt câu hỏi về chỗ ở và dịch vụ.',
            'Ask about your stay and services.',
          ),
        },
        {
          id: id(18),
          type: 'contact_help',
          enabled: true,
          title: emptyLocalized('Liên hệ lễ tân', 'Contact front desk'),
          body: emptyLocalized('Chúng tôi luôn sẵn sàng hỗ trợ.', 'We are here to help.'),
          phone: null,
          email: '',
        },
      ],
    },
  },
  {
    id: 'resort_default',
    propertyType: 'resort',
    name: 'Resort default',
    config: {
      schemaVersion: 1,
      templateId: 'resort_default',
      greeting: emptyLocalized('Chào mừng đến resort', 'Welcome to the resort'),
      assistant: {
        name: emptyLocalized('Trợ lý resort', 'Resort assistant'),
        avatarAssetId: null,
      },
      primaryNavigation: [
        {
          id: id(21),
          label: emptyLocalized('Trang chủ', 'Home'),
          href: '/',
          visible: true,
        },
        {
          id: id(22),
          label: emptyLocalized('Trải nghiệm', 'Experiences'),
          href: '/experiences',
          visible: true,
        },
      ],
      secondaryNavigation: [],
      sections: [
        {
          id: id(30),
          type: 'hero',
          enabled: true,
          title: emptyLocalized('Kỳ nghỉ thư giãn', 'A relaxing getaway'),
          subtitle: emptyLocalized('Khám phá hồ bơi, spa và ẩm thực', 'Explore pool, spa and dining'),
          ctaLabel: emptyLocalized('Khám phá', 'Explore'),
          ctaHref: '/experiences',
        },
        {
          id: id(31),
          type: 'quick_actions',
          enabled: true,
          title: emptyLocalized('Thao tác nhanh', 'Quick actions'),
          actions: [
            {
              id: id(311),
              label: emptyLocalized('Đặt spa', 'Book spa'),
              href: '/spa',
              icon: 'info',
            },
          ],
        },
        {
          id: id(32),
          type: 'assistant_callout',
          enabled: true,
          title: emptyLocalized('Hỏi trợ lý', 'Ask the assistant'),
          body: emptyLocalized('Hỏi về lịch trình và dịch vụ.', 'Ask about schedules and services.'),
        },
        {
          id: id(33),
          type: 'contact_help',
          enabled: true,
          title: emptyLocalized('Liên hệ', 'Contact'),
          body: emptyLocalized('Concierge luôn sẵn sàng.', 'Concierge is available.'),
          phone: null,
          email: '',
        },
      ],
    },
  },
  {
    id: 'airbnb_default',
    propertyType: 'airbnb',
    name: 'Vacation rental default',
    config: {
      schemaVersion: 1,
      templateId: 'airbnb_default',
      greeting: emptyLocalized('Chào mừng đến nhà', 'Welcome home'),
      assistant: {
        name: emptyLocalized('Trợ lý lưu trú', 'Stay assistant'),
        avatarAssetId: null,
      },
      primaryNavigation: [
        {
          id: id(41),
          label: emptyLocalized('Trang chủ', 'Home'),
          href: '/',
          visible: true,
        },
        {
          id: id(42),
          label: emptyLocalized('Hướng dẫn nhà', 'House guide'),
          href: '/guide',
          visible: true,
        },
      ],
      secondaryNavigation: [],
      sections: [
        {
          id: id(50),
          type: 'hero',
          enabled: true,
          title: emptyLocalized('Thoải mái như ở nhà', 'Make yourself at home'),
          subtitle: emptyLocalized('Xem hướng dẫn check-in và tiện nghi', 'See check-in and amenity guides'),
          ctaLabel: emptyLocalized('Xem hướng dẫn', 'View guide'),
          ctaHref: '/guide',
        },
        {
          id: id(51),
          type: 'guide_links',
          enabled: true,
          title: emptyLocalized('Hướng dẫn nhà', 'House guides'),
          links: [
            {
              id: id(511),
              label: emptyLocalized('Wi‑Fi', 'Wi‑Fi'),
              href: '/guide/wifi',
            },
            {
              id: id(512),
              label: emptyLocalized('Check-out', 'Check-out'),
              href: '/guide/checkout',
            },
          ],
        },
        {
          id: id(52),
          type: 'assistant_callout',
          enabled: true,
          title: emptyLocalized('Hỏi trợ lý', 'Ask the assistant'),
          body: emptyLocalized('Hỏi về nhà và khu vực xung quanh.', 'Ask about the home and neighborhood.'),
        },
        {
          id: id(53),
          type: 'contact_help',
          enabled: true,
          title: emptyLocalized('Liên hệ host', 'Contact host'),
          body: emptyLocalized('Host sẽ phản hồi sớm.', 'Your host will respond soon.'),
          phone: null,
          email: '',
        },
      ],
    },
  },
];

export function templateForPropertyType(propertyType: string): (typeof PORTAL_TEMPLATE_SEEDS)[number] {
  return (
    PORTAL_TEMPLATE_SEEDS.find((item) => item.propertyType === propertyType) ??
    PORTAL_TEMPLATE_SEEDS[0]!
  );
}
