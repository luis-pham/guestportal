import type { GuestOrderStatus, GuestRequestStatus } from '@guestportal/contracts';
import { ApiError } from '../errors.js';

export const requestTransitions: Readonly<
  Record<GuestRequestStatus, readonly GuestRequestStatus[]>
> = {
  submitted: ['accepted', 'rejected', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  rejected: [],
  cancelled: [],
  completed: [],
};

export const orderTransitions: Readonly<Record<GuestOrderStatus, readonly GuestOrderStatus[]>> = {
  submitted: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivering', 'completed', 'cancelled'],
  delivering: ['completed', 'cancelled'],
  cancelled: [],
  completed: [],
};

export function assertRequestTransition(
  current: GuestRequestStatus,
  next: GuestRequestStatus,
): void {
  if (requestTransitions[current]?.includes(next) !== true) {
    throw new ApiError(409, 'REQUEST_INVALID_TRANSITION', 'Request transition is not allowed.', {
      currentStatus: current,
      nextStatus: next,
    });
  }
}

export function assertOrderTransition(current: GuestOrderStatus, next: GuestOrderStatus): void {
  if (orderTransitions[current]?.includes(next) !== true) {
    throw new ApiError(409, 'ORDER_INVALID_TRANSITION', 'Order transition is not allowed.', {
      currentStatus: current,
      nextStatus: next,
    });
  }
}
