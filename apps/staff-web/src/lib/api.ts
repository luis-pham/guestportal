const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}

export type StaffWorkQueue = 'inbox' | 'my_work' | 'history' | 'all';
export type StaffWorkItem = {
  kind: 'request' | 'order';
  id: string;
  status: string;
  version: number;
  title: string;
  summary: string;
  locale: string;
  conversationId: string;
  location: {
    id: string;
    code: string;
    name: { vi: string; en: string };
  };
  assignee: { id: string; displayName: string } | null;
  submittedAt: string;
  waitingSeconds: number;
  priority: 'normal';
  totalMinor?: number;
  currency?: string;
};

export type StaffMessage = {
  id: string;
  sequence: number;
  role: string;
  source: string;
  originalLanguage: string | null;
  originalText: string;
  translatedText: string | null;
  createdAt: string;
};

export type StaffTimelineItem = {
  id: string;
  previousStatus: string | null;
  nextStatus: string;
  actorType: 'guest' | 'staff' | 'system';
  actorId: string | null;
  reason: string | null;
  version: number;
  createdAt: string;
};

export type StaffRequestDetail = {
  kind: 'request';
  request: {
    id: string;
    status: string;
    version: number;
    requestType: string;
    title: string;
    details: string;
    locale: string;
    submittedAt: string;
  };
  location: StaffWorkItem['location'];
  assignee: StaffWorkItem['assignee'];
  messages: StaffMessage[];
  timeline: StaffTimelineItem[];
};

export type StaffOrderDetail = {
  kind: 'order';
  order: {
    id: string;
    status: string;
    version: number;
    title: string;
    items: Array<{
      itemId: string;
      label: string;
      quantity: number;
      unitPriceMinor: number;
      currency: string;
      notes: string;
      optionsSnapshot: Record<string, unknown>;
    }>;
    totalMinor: number;
    currency: string;
    notes: string;
    locale: string;
    submittedAt: string;
  };
  location: StaffWorkItem['location'];
  assignee: StaffWorkItem['assignee'];
  messages: StaffMessage[];
  timeline: StaffTimelineItem[];
};

export type StaffWorkDetail = StaffRequestDetail | StaffOrderDetail;

export async function fetchStaffWorkItems({
  propertyId,
  queue,
  status,
}: {
  propertyId: string;
  queue: StaffWorkQueue;
  status: string;
}) {
  const params = new URLSearchParams({ propertyId, queue });
  if (status !== 'all') params.set('status', status);
  return apiFetch<{ items: StaffWorkItem[] }>(`/v1/staff/work-items?${params.toString()}`);
}

export async function fetchStaffDetail(item: Pick<StaffWorkItem, 'kind' | 'id'>) {
  const path =
    item.kind === 'request' ? `/v1/staff/requests/${item.id}` : `/v1/staff/orders/${item.id}`;
  return apiFetch<StaffWorkDetail>(path);
}
