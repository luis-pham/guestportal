import { StaffWorkspace } from '../../../../components/StaffWorkspace';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <StaffWorkspace routeKey="order" detailId={orderId} />;
}
