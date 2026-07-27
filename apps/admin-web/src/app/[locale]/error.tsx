'use client';

import { useEffect } from 'react';
import { Button } from '@guestportal/ui';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="gp-state gp-state--error">
      <h1 className="gp-state__title">Unable to load this workspace</h1>
      <p className="gp-state__body">Please retry the page. Your session and selected tenant are unchanged.</p>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
