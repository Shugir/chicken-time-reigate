import { getTransporter } from './transporter'
import * as templates from './templates'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface SenderConfig {
  name:    string
  address: string
}

async function getSender(): Promise<SenderConfig> {
  const { data } = await supabaseAdmin
    .from('store_settings')
    .select('email_sender_name, email_sender_address')
    .eq('id', 1)
    .maybeSingle()

  return {
    name:    data?.email_sender_name    ?? 'Restaurant Orders',
    address: data?.email_sender_address ?? (process.env.SMTP_USER ?? ''),
  }
}

async function safeSend(to: string, subject: string, html: string, sender: SenderConfig) {
  const transporter = getTransporter()
  const from = `"${sender.name}" <${sender.address}>`
  const isDryRun = !process.env.SMTP_HOST

  if (isDryRun) {
    console.log('\n── EMAIL DRY-RUN ──────────────────────────────────')
    console.log(`  From:    ${from}`)
    console.log(`  To:      ${to}`)
    console.log(`  Subject: ${subject}`)
    console.log('───────────────────────────────────────────────────\n')
    return
  }

  await transporter.sendMail({ from, to, subject, html })
}

/** Fire-and-forget: dispatched notification with track link. */
export function sendDispatchedEmail(opts: {
  orderId:      string
  to:           string | null
  customerName: string | null
  driverName:   string | null
  origin:       string
}): void {
  if (!opts.to) return
  const trackUrl = `${opts.origin}/track/${opts.orderId}`
  const { subject, html } = templates.dispatched({
    orderId:      opts.orderId,
    customerName: opts.customerName,
    driverName:   opts.driverName,
    trackUrl,
  })

  Promise.all([getSender()])
    .then(([sender]) => safeSend(opts.to!, subject, html, sender))
    .catch((err) => console.error('[email] dispatched send failed:', err))
}

/** Fire-and-forget: delivered / collected notification. */
export function sendDeliveredEmail(opts: {
  orderId:      string
  to:           string | null
  customerName: string | null
  isPickup:     boolean
}): void {
  if (!opts.to) return
  const { subject, html } = templates.delivered({
    orderId:      opts.orderId,
    customerName: opts.customerName,
    isPickup:     opts.isPickup,
  })

  Promise.all([getSender()])
    .then(([sender]) => safeSend(opts.to!, subject, html, sender))
    .catch((err) => console.error('[email] delivered send failed:', err))
}
