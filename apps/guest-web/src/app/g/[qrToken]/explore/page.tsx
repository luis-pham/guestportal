import { GuestPortalApp } from '../../../../components/GuestPortalApp';

export default async function GuestExplorePage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  return <GuestPortalApp qrToken={qrToken} view="explore" />;
}
