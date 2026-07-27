import { GuestPortalApp } from '../../../../../components/GuestPortalApp';

export default async function GuestRequestTypePage({
  params,
}: {
  params: Promise<{ qrToken: string; requestType: string }>;
}) {
  const { qrToken } = await params;
  return <GuestPortalApp qrToken={qrToken} view="services" />;
}
