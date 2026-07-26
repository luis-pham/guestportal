import type { ReactNode } from 'react';
import '@guestportal/ui/tokens.css';

export const metadata = {
  title: 'GuestPortal',
  description: 'Guest portal foundation',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
