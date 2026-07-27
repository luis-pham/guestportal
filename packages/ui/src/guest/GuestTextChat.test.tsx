import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { GuestTextChat, type GuestChatMessage } from './GuestTextChat';

const messages: GuestChatMessage[] = [
  {
    id: 'm1',
    role: 'guest',
    text: 'Can I get two towels?',
  },
  {
    id: 'm2',
    role: 'assistant',
    text: 'Housekeeping can bring towels to your room.',
    translatedText: 'Bộ phận buồng phòng có thể mang khăn lên phòng.',
    citations: [
      {
        id: 'c1',
        label: 'policy',
        sourceTitle: 'Guest Services Guide',
        excerpt: 'Housekeeping delivery is available all day.',
        href: '#services',
      },
    ],
  },
];

describe('GuestTextChat', () => {
  it('shows transcript messages with citations', () => {
    render(<GuestTextChat messages={messages} />);

    expect(screen.getByTestId('chat-message-m1')).toHaveTextContent('Can I get two towels?');
    expect(screen.getByTestId('chat-message-m2')).toHaveTextContent('Housekeeping can bring');
    expect(screen.getByTestId('chat-citation-c1')).toHaveTextContent('Guest Services Guide');
  });

  it('keeps confirmation explicit and calls confirm or cancel handlers', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <GuestTextChat
        messages={messages}
        confirmation={{
          id: 'draft_1',
          kind: 'request',
          title: 'Two extra towels',
          summary: 'Send a housekeeping request to room 1208.',
          expiresAtLabel: '14:30',
          status: 'needs_confirmation',
          onConfirm,
          onCancel,
        }}
      />,
    );

    const card = screen.getByTestId('chat-confirmation-card');
    expect(card).toHaveTextContent('Confirm before sending');
    expect(card).toHaveTextContent('Two extra towels');
    expect(card).toHaveTextContent('Expires: 14:30');

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('surfaces network recovery and retry without losing history', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <GuestTextChat
        connectionState="offline"
        messages={messages}
        recoveryMessage="Network dropped. Reconnect when ready."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByTestId('chat-recovery')).toHaveTextContent('Network dropped');
    expect(screen.getByTestId('chat-message-m1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sends trimmed composer text only when content exists', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const { rerender } = render(
      <GuestTextChat
        composerValue=""
        onComposerChange={() => undefined}
        onSend={onSend}
      />,
    );

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    rerender(
      <GuestTextChat
        composerValue="  Please book a taxi  "
        onComposerChange={() => undefined}
        onSend={onSend}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Please book a taxi');
  });

  it('renders sample labels in Vietnamese, English, and Korean', () => {
    const { rerender } = render(<GuestTextChat locale="vi" />);
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeInTheDocument();

    rerender(<GuestTextChat locale="en" />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();

    rerender(<GuestTextChat locale="ko" />);
    expect(screen.getByRole('button', { name: '보내기' })).toBeInTheDocument();
  });

  it('has no axe violations in the rich mobile chat state', async () => {
    const { container } = render(
      <GuestTextChat
        locale="vi"
        connectionState="recovering"
        messages={messages}
        confirmation={{
          id: 'draft_2',
          kind: 'order',
          title: 'Bún chay và nước cam',
          summary: 'Gửi đơn món ăn lên nhà hàng để xác nhận.',
          expiresAtLabel: '15:00',
          status: 'needs_confirmation',
        }}
        recoveryMessage="Đang kết nối lại. Bạn vẫn có thể đọc lịch sử chat."
      />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
