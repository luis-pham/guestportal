import { AppShellPlaceholder } from '@guestportal/ui';

export default function StaffHomePage() {
  return (
    <AppShellPlaceholder
      surface="staff"
      title="Staff foundation"
      subtitle="Phase 00 mobile-first shell placeholder."
      primaryNav={['Inbox', 'My work', 'Messages', 'More']}
      secondaryNav={['New', 'Assigned to me', 'Waiting']}
    />
  );
}
