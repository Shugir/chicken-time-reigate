export interface SlotPick { item_id: string; qty: number }
export interface SlotGroup { min_qty: number; max_qty: number }

export function slotQty(picks: SlotPick[]): number {
  return picks.reduce((s, p) => s + p.qty, 0)
}

export function isSelectionComplete(groups: SlotGroup[], picksByGroup: Record<number, SlotPick[]>): boolean {
  return groups.every((g, i) => {
    const count = slotQty(picksByGroup[i] ?? [])
    return count >= g.min_qty && count <= g.max_qty
  })
}

export interface UpgradeLine { price: number; qty: number }

/** Sum of the chosen upgrade lines at their menu price, rounded to 2dp. */
export function upgradesTotal(lines: UpgradeLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100
}
