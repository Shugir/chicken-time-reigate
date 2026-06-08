import { describe, it, expect } from 'vitest'
import { buildDriverOrderUpdate, buildKitchenDeliveryUpdate, buildDispatchActionUpdate } from './order-status'

describe('buildDriverOrderUpdate', () => {
  it('delivered: sets both delivery_status and status to delivered', () => {
    const update = buildDriverOrderUpdate('delivered')
    expect(update.status).toBe('delivered')
    expect(update.delivery_status).toBe('delivered')
  })

  it('return_to_kitchen: resets status to ready and clears driver/delivery fields', () => {
    const update = buildDriverOrderUpdate('return_to_kitchen')
    expect(update.status).toBe('ready')
    expect(update.delivery_status).toBeNull()
    expect(update.driver_id).toBeNull()
  })
})

describe('buildKitchenDeliveryUpdate', () => {
  it('delivered: sets both delivery_status and status to delivered', () => {
    const update = buildKitchenDeliveryUpdate('delivered')
    expect(update.status).toBe('delivered')
    expect(update.delivery_status).toBe('delivered')
  })

  it('failed: sets both delivery_status and status to failed', () => {
    const update = buildKitchenDeliveryUpdate('failed')
    expect(update.status).toBe('failed')
    expect(update.delivery_status).toBe('failed')
  })

  it('failed with reason: includes failure_reason', () => {
    const update = buildKitchenDeliveryUpdate('failed', 'No answer')
    expect(update.failure_reason).toBe('No answer')
  })

  it('delivered: does not include failure_reason', () => {
    const update = buildKitchenDeliveryUpdate('delivered')
    expect(update.failure_reason).toBeUndefined()
  })
})

describe('buildDriverOrderUpdate - return_to_kitchen with reason', () => {
  it('return_to_kitchen with reason: includes return_reason in update', () => {
    const update = buildDriverOrderUpdate('return_to_kitchen', 'Damaged')
    expect(update.return_reason).toBe('Damaged')
  })

  it('return_to_kitchen without reason: does not include return_reason', () => {
    const update = buildDriverOrderUpdate('return_to_kitchen')
    expect(update.return_reason).toBeUndefined()
  })

  it('return_to_kitchen with reason: still resets status and clears driver fields', () => {
    const update = buildDriverOrderUpdate('return_to_kitchen', 'No Answer')
    expect(update.status).toBe('ready')
    expect(update.delivery_status).toBeNull()
    expect(update.driver_id).toBeNull()
  })

  it('delivered: does not include return_reason even when reason passed', () => {
    const update = buildDriverOrderUpdate('delivered', 'irrelevant')
    expect(update.return_reason).toBeUndefined()
  })
})

describe('buildDispatchActionUpdate', () => {
  it('delivered: sets both delivery_status and status to delivered', () => {
    const update = buildDispatchActionUpdate('delivered')
    expect(update.status).toBe('delivered')
    expect(update.delivery_status).toBe('delivered')
  })

  it('failed: sets both delivery_status and status to failed', () => {
    const update = buildDispatchActionUpdate('failed')
    expect(update.status).toBe('failed')
    expect(update.delivery_status).toBe('failed')
  })

  it('failed: uses provided failure_reason', () => {
    const update = buildDispatchActionUpdate('failed', 'Wrong address')
    expect(update.failure_reason).toBe('Wrong address')
  })

  it('failed: defaults failure_reason to Unknown when not provided', () => {
    const update = buildDispatchActionUpdate('failed')
    expect(update.failure_reason).toBe('Unknown')
  })

  it('send_back: resets to preparing and clears driver assignment', () => {
    const update = buildDispatchActionUpdate('send_back')
    expect(update.status).toBe('preparing')
    expect(update.delivery_status).toBeNull()
    expect(update.driver_id).toBeNull()
    expect(update.stop_sequence).toBe(1)
  })
})
