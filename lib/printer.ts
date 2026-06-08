import net from 'node:net'

const WIDTH = 48
const ESC = '\x1b'
const GS = '\x1d'

/**
 * Formats a long string into lines of max WIDTH, splitting on spaces.
 */
function wrapLine(s: string): string[] {
  if (s.length <= WIDTH) return [s]
  const words = s.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w
    if (next.length > WIDTH) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines
}

/**
 * Creates a two-column row. If the left side is too long, it wraps.
 */
function formatRow(l: string, r: string): string {
  if (l.length + r.length + 1 > WIDTH) {
    return l + '\n' + ' '.repeat(WIDTH - r.length) + r + '\n'
  }
  return l + ' '.repeat(WIDTH - l.length - r.length) + r + '\n'
}

/**
 * Generates the raw ESC/POS bytes for an order receipt.
 */
export function generateReceiptBuffer(order: any, driverName?: string): Buffer {
  const chunks: string[] = []
  const rule = '-'.repeat(WIDTH) + '\n'
  const GBP = (n: number) => '\xa3' + Number(n).toFixed(2) // 0xA3 = £ in latin1 (CP850/PC858)

  // 1. Initialize
  chunks.push(ESC + '@')
  
  // 2. Header
  chunks.push(ESC + 'a\x01') // Center
  chunks.push(ESC + 'E\x01') // Bold On
  chunks.push(GS + '!\x11')  // Double size
  chunks.push('CHICKEN TIME\nREIGATE\n')
  chunks.push(GS + '!\x00')  // Normal size
  chunks.push(ESC + 'E\x00') // Bold Off
  chunks.push('01737 000 000\nchickentimesurrey.co.uk\n')
  
  // 3. Order Info
  chunks.push(ESC + 'a\x00') // Left
  chunks.push(rule)
  const date = new Date(order.created_at)
  chunks.push(formatRow('Order', '#' + order.id.slice(-6).toUpperCase()))
  chunks.push(formatRow('Date', date.toLocaleDateString('en-GB')))
  chunks.push(formatRow('Time', date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })))
  if (order.customer_name) chunks.push(formatRow('Customer', order.customer_name))
  if (order.customer_phone) chunks.push(formatRow('Phone', order.customer_phone))
  chunks.push(rule)

  // 4. Items
  const items = order.order_items ?? []
  let subtotal = 0
  for (const it of items) {
    const itemTotal = it.unit_price * it.quantity
    subtotal += itemTotal
    chunks.push(formatRow(`${it.quantity}x ${it.item_name ?? 'Item'}`, GBP(itemTotal)))
    for (const e of it.extras ?? []) {
      chunks.push(formatRow(`  + ${e.name}`, GBP(e.price)))
    }
    for (const r of it.removals ?? []) {
      chunks.push(`  - No ${r}\n`)
    }
    if (it.notes) {
      wrapLine(`  * ${it.notes}`).forEach(l => chunks.push(l + '\n'))
    }
  }

  // 5. Totals
  chunks.push(rule)
  const delivery = Math.max(0, Number(order.total_amount) - subtotal)
  chunks.push(formatRow('Subtotal', GBP(subtotal)))
  chunks.push(formatRow('Delivery', GBP(delivery)))
  chunks.push(ESC + 'E\x01') // Bold On
  chunks.push(formatRow('TOTAL', GBP(order.total_amount)))
  chunks.push(ESC + 'E\x00') // Bold Off

  // 6. Delivery Details
  if (order.delivery_address) {
    chunks.push(rule)
    chunks.push(ESC + 'a\x01') // Center
    chunks.push(ESC + 'E\x01') // Bold On
    chunks.push('--- DELIVERY DETAILS ---\n')
    chunks.push(ESC + 'a\x00') // Left
    chunks.push(ESC + 'E\x00') // Bold Off
    if (order.customer_name) chunks.push(order.customer_name + '\n')
    if (order.customer_phone) chunks.push(order.customer_phone + '\n')
    wrapLine(order.delivery_address).forEach(l => chunks.push(l + '\n'))
    if (order.delivery_postcode) chunks.push(order.delivery_postcode.toUpperCase() + '\n')
    if (order.customer_notes) {
      wrapLine('NOTE: ' + order.customer_notes).forEach(l => chunks.push(l + '\n'))
    }
  }

  // 7. Footer
  chunks.push(rule)
  chunks.push(ESC + 'a\x01') // Center
  if (driverName) chunks.push('Driver: ' + driverName + '\n')
  chunks.push('Thank you for your order!\n')
  
  // 8. Feed and Cut
  chunks.push(ESC + 'd\x02') // Feed 2 lines
  chunks.push(GS + 'VA\x03') // Full cut

  return Buffer.from(chunks.join(''), 'latin1')
}

/**
 * Sends a buffer to a TCP printer.
 */
export async function sendToPrinter(buffer: Buffer, host: string = 'localhost', port: number = 9100): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      socket.write(buffer, () => {
        socket.end()
        resolve()
      })
    })

    socket.setTimeout(5000)
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Printer connection timed out'))
    })

    socket.on('error', (err) => {
      reject(err)
    })
  })
}
