import { AppShellPlaceholder } from '@guestportal/ui';

export default function AdminHomePage() {
  return (
    <AppShellPlaceholder
      surface="admin"
      title="Admin foundation"
      subtitle="Phase 00 app shell placeholder using shared design tokens."
      primaryNav={[
        'Overview',
        'Portal',
        'Knowledge',
        'Catalog',
        'Operations',
        'Analytics',
        'Team',
        'Settings',
      ]}
      secondaryNav={['Dashboard', 'Properties']}
    />
  );
}
