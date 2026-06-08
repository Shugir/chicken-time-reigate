// Pure functions for order status transitions — testable without DB

export type DriverAction = 'delivered' | 'return_to_kitchen'
export type DeliveryOutcome = 'delivered' | 'failed'

export function buildDriverOrderUpdate(action: DriverAction): Record<string, unknown> {
  if (action === 'delivered') {
    return { delivery_status: 'delivered', status: 'delivered' }
  }
  return { status: 'ready', delivery_status: null, driver_id: null }
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
  action: 'delivered' | 'failed' | 'send_back',
  failure_reason?: string,
): Record<string, unknown> {
  if (action === 'delivered') {
    return { delivery_status: 'delivered', status: 'delivered' }
  }
  if (action === 'failed') {
    return { delivery_status: 'failed', status: 'failed', failure_reason: failure_reason ?? 'Unknown' }
  }
  return { status: 'preparing', delivery_status: null, driver_id: null, stop_sequence: 1 }
}
