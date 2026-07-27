import { StaffWorkspace } from '../../../../components/StaffWorkspace';

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <StaffWorkspace routeKey="request" detailId={requestId} />;
}
