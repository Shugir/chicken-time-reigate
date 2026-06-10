const BRAND = {
  red:  '#dc2626',
  dark: '#111827',
  gray: '#6b7280',
}

function shell(content: string, subject: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <tr><td style="background:#111;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:26px;">🍗</p>
        <p style="margin:4px 0 0;font-size:17px;font-weight:800;color:#fff;letter-spacing:1px;text-transform:uppercase;">Chicken Time</p>
        <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;letter-spacing:3px;text-transform:uppercase;">Reigate</p>
      </td></tr>
      ${content}
      <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">Chicken Time &middot; Reigate &middot; Surrey</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export interface DispatchedTemplateData {
  orderId:         string
  customerName:    string | null
  driverName:      string | null
  trackUrl:        string
}

export function dispatched(data: DispatchedTemplateData): { subject: string; html: string } {
  const name = data.customerName ?? 'there'
  const ref  = `#${data.orderId.slice(-6).toUpperCase()}`
  const driver = data.driverName ? `<p style="margin:0 0 4px;font-size:14px;color:#374151;">🛵 Your driver <strong>${data.driverName}</strong> is on the way.</p>` : ''

  const html = shell(`
    <tr><td style="background:${BRAND.red};padding:22px 32px;text-align:center;">
      <p style="margin:0;font-size:34px;">🚀</p>
      <p style="margin:6px 0 0;font-size:21px;font-weight:800;color:#fff;">Your Order is On Its Way!</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">Great news — your food is heading to you right now.</p>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${name},</p>
      ${driver}
      <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.7;">
        Your hot, fresh order <strong>${ref}</strong> is out for delivery.
        Please make sure someone is available to receive it.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${data.trackUrl}"
           style="display:inline-block;background:${BRAND.red};color:#fff;font-size:15px;font-weight:700;
                  padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:.3px;">
          Track My Order →
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#9ca3af;">Questions? Reply to this email or call us.</p>
    </td></tr>
  `, 'Your Order is On Its Way! – Chicken Time Reigate')

  return { subject: '🚀 Your Order is On Its Way! – Chicken Time Reigate', html }
}

export interface DeliveredTemplateData {
  orderId:      string
  customerName: string | null
  isPickup:     boolean
}

export function delivered(data: DeliveredTemplateData): { subject: string; html: string } {
  const name    = data.customerName ?? 'there'
  const ref     = `#${data.orderId.slice(-6).toUpperCase()}`
  const verb    = data.isPickup ? 'collected' : 'delivered'
  const emoji   = data.isPickup ? '🛍️' : '🍗'
  const headline = data.isPickup ? 'Order Collected — Enjoy!' : 'Delivered — Enjoy Your Meal!'
  const message  = data.isPickup
    ? 'Your order has been collected. We hope you enjoy every bite!'
    : 'Your order has been delivered. We hope you enjoy every bite!'

  const html = shell(`
    <tr><td style="background:#16a34a;padding:22px 32px;text-align:center;">
      <p style="margin:0;font-size:34px;">${emoji}</p>
      <p style="margin:6px 0 0;font-size:21px;font-weight:800;color:#fff;">${headline}</p>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">Order ${ref} ${verb}. Thank you!</p>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${name},</p>
      <p style="margin:0 0 22px;font-size:14px;color:#4b5563;line-height:1.7;">${message}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.7;">
        We would love to see you again soon. Follow us on social media for deals and new menu items.
      </p>
      <p style="margin:0;font-size:13px;color:#9ca3af;">Thank you for choosing Chicken Time Reigate!</p>
    </td></tr>
  `, `${headline} – Chicken Time Reigate`)

  return { subject: `${emoji} ${headline} – Chicken Time Reigate`, html }
}
