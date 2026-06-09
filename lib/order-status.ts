// Pure functions for order status transitions — testable without DB

export type DriverAction = 'delivered' | 'return_to_kitchen'
export type DeliveryOutcome = 'delivered' | 'failed'

export function buildDriverOrderUpdate(action: DriverAction, return_reason?: string): Record<string, unknown> {
  if (action === 'delivered') {
    return { delivery_status: 'delivered', status: 'delivered' }
  }
  // return_to_kitchen: food physically back at restaurant — needs manager decision
  const update: Record<string, unknown> = {
    status: 'returned',
    delivery_status: 'returned',
    driver_id: null,
    stop_sequence: 1,
  }
  if (return_reason) update.return_reason = return_reason
  return update
}

export function buildKitchenDeliveryUpdate(
  delivery_status: DeliveryOutcome,
  failure_reason?: string,
): Record<string, unknown> {
  const update: Record<string, unknown> = { delivery_status, status: delivery_status }
  if (delivery_status === 'failed' && failure_reason) {
    update.failure_reason = failure_reason
  }
  return update
}

export function buildDispatchActionUpdate(
  action: 'delivered' | 'failed' | 'send_back' | 'remake' | 'cancel' | 'hold',
  reason?: string,
): Record<string, unknown> {
  switch (action) {
    case 'delivered':
      return { delivery_status: 'delivered', status: 'delivered' }
    case 'failed':
      return { delivery_status: 'failed', status: 'failed', failure_reason: reason ?? 'Unknown' }
    case 'send_back':
      return { status: 'preparing', delivery_status: null, driver_id: null, stop_sequence: 1 }
    case 'remake':
      // Food was damaged/cold — send back to kitchen prep queue for fresh make
      return { status: 'preparing', delivery_status: null, driver_id: null, stop_sequence: 1, return_reason: null }
    case 'cancel':
      return { status: 'cancelled', delivery_status: 'cancelled' }
    case 'hold':
      // Manager actively contacting customer — stays in returned section
      return { delivery_status: 'on_hold' }
  }
}
