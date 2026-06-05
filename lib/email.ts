import { Resend } from 'resend'

export interface EmailOrderData {
  id: string
  customer_name: string | null
  total_amount: number
  delivery_address: string | null
  items?: Array<{ name: string; quantity: number }>
}

export type OrderEmailStatus = 'received' | 'cooking' | 'out_for_delivery'

const STATUS_CONFIG: Record<OrderEmailStatus, {
  subject: string
  headline: string
  subheadline: string
  icon: string
  color: string
  message: string
}> = {
  received: {
    subject:     '🍗 Order Confirmed – Chicken Time Reigate',
    headline:    'Order Confirmed!',
    subheadline: "We've got your order and we're getting started.",
    icon:        '🍗',
    color:       '#dc2626',
    message:     "Your order has been received. We'll send you another update as soon as we start cooking.",
  },
  cooking: {
    subject:     '👨‍🍳 Your Order is Being Prepared – Chicken Time Reigate',
    headline:    "We're Cooking!",
    subheadline: 'Your food is being freshly prepared right now.',
    icon:        '👨‍🍳',
    color:       '#d97706',
    message:     "Our kitchen team are working on your order. It won't be long — we'll let you know when it's on its way.",
  },
  out_for_delivery: {
    subject:     '🛵 Your Order is On Its Way! – Chicken Time Reigate',
    headline:    "On Its Way!",
    subheadline: 'Your driver is heading to you right now.',
    icon:        '🛵',
    color:       '#16a34a',
    message:     "Your hot, fresh order is out for delivery. Please make sure someone is available to receive it.",
  },
}

function buildHtml(order: EmailOrderData, status: OrderEmailStatus): string {
  const cfg   = STATUS_CONFIG[status]
  const ref   = `#${order.id.slice(-6).toUpperCase()}`
  const name  = order.customer_name ?? 'Valued Customer'
  const total = `£${Number(order.total_amount).toFixed(2)}`

  const itemRows = order.items && order.items.length > 0
    ? order.items.map((i) =>
        `<tr>
           <td style="font-size:14px;color:#374151;padding:7px 0;border-bottom:1px solid #f3f4f6;">${i.name}</td>
           <td style="font-size:14px;color:#374151;padding:7px 0;border-bottom:1px solid #f3f4f6;text-align:right;">×${i.quantity}</td>
         </tr>`,
      ).join('')
    : ''

  const itemsSection = itemRows
    ? `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
         <thead><tr>
           <td style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;padding:6px 0;border-bottom:1px solid #e5e7eb;">Item</td>
           <td style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;">Qty</td>
         </tr></thead>
         <tbody>${itemRows}</tbody>
         <tfoot><tr>
           <td style="font-size:15px;font-weight:700;color:#111827;padding:10px 0 2px;">Total</td>
           <td style="font-size:15px;font-weight:700;color:#dc2626;padding:10px 0 2px;text-align:right;">${total}</td>
         </tr></tfoot>
       </table>`
    : `<p style="font-size:14px;color:#6b7280;margin:0 0 20px;">Order ${ref} &middot; ${total}</p>`

  const addrLine = order.delivery_address
    ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">📍 ${order.delivery_address}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${cfg.subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

      <tr><td style="background:#111;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:26px;">🍗</p>
        <p style="margin:4px 0 0;font-size:17px;font-weight:800;color:#fff;letter-spacing:1px;text-transform:uppercase;">Chicken Time</p>
        <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;letter-spacing:3px;text-transform:uppercase;">Reigate</p>
      </td></tr>

      <tr><td style="background:${cfg.color};padding:22px 32px;text-align:center;">
        <p style="margin:0;font-size:34px;">${cfg.icon}</p>
        <p style="margin:6px 0 0;font-size:21px;font-weight:800;color:#fff;">${cfg.headline}</p>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">${cfg.subheadline}</p>
      </td></tr>

      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 6px;font-size:16px;color:#111827;">Hi ${name},</p>
        <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.7;">${cfg.message}</p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:22px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Order Reference</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#111827;font-family:monospace;">${ref}</p>
          ${addrLine}
        </div>

        ${itemsSection}

        <p style="margin:0;font-size:13px;color:#9ca3af;">Questions? Call <strong style="color:#374151;">01737 000 000</strong> or reply to this email.</p>
      </td></tr>

      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">Chicken Time &middot; Reigate &middot; Surrey</p>
        <p style="margin:3px 0 0;font-size:12px;color:#9ca3af;">chickentimesurrey.co.uk</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

export async function sendOrderStatusEmail(
  order: EmailOrderData,
  status: OrderEmailStatus,
  recipientEmail: string | null,
): Promise<void> {
  if (!recipientEmail) return

  const cfg = STATUS_CONFIG[status]
  const ref = `#${order.id.slice(-6).toUpperCase()}`

  try {
    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      console.log('\n──────────────────────────────────────────────────')
      console.log('📧  [EMAIL DRY-RUN — set RESEND_API_KEY to send]')
      console.log(`    To:      ${recipientEmail}`)
      console.log(`    Subject: ${cfg.subject}`)
      console.log(`    Order:   ${ref}  Status: ${status}`)
      console.log('──────────────────────────────────────────────────\n')
      return
    }

    const resend = new Resend(apiKey)
    await resend.emails.send({
      from:    'Chicken Time <orders@chickentimesurrey.co.uk>',
      to:      [recipientEmail],
      subject: cfg.subject,
      html:    buildHtml(order, status),
    })
  } catch (err) {
    console.error(`[email] Failed to send "${status}" email to ${recipientEmail}:`, err)
  }
}
