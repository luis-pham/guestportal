import type { Meta, StoryObj } from '@storybook/react';
import { GuestTextChat, type GuestChatMessage } from './GuestTextChat';
import './guest-chat.css';

const messages: GuestChatMessage[] = [
  {
    id: 'story-guest',
    role: 'guest',
    text: 'Can you send two extra towels and check late checkout?',
  },
  {
    id: 'story-assistant',
    role: 'assistant',
    text: 'Yes. Housekeeping can bring towels now. Late checkout is available until 13:00.',
    translatedText: 'Có. Bộ phận buồng phòng có thể mang khăn ngay. Trả phòng muộn đến 13:00.',
    citations: [
      {
        id: 'housekeeping',
        label: 'housekeeping',
        sourceTitle: 'Guest Services Guide',
        excerpt: 'Housekeeping requests can be delivered to occupied rooms.',
      },
      {
        id: 'late-checkout',
        label: 'late-checkout',
        sourceTitle: 'Front Desk Policy',
        excerpt: 'Late checkout is subject to room availability.',
      },
    ],
  },
];

const meta = {
  title: 'Guest/GuestTextChat',
  component: GuestTextChat,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof GuestTextChat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    locale: 'vi',
    assistantName: 'Aurora Assistant',
    connectionState: 'recovering',
    messages,
    confirmation: {
      id: 'story-draft',
      kind: 'request',
      title: 'Two extra towels',
      summary: 'Send a housekeeping request to room 1208.',
      expiresAtLabel: '14:30',
      status: 'needs_confirmation',
    },
    recoveryMessage: 'Đang kết nối lại. Lịch sử chat vẫn được giữ.',
    composerValue: 'Cảm ơn bạn',
  },
};
