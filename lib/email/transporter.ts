import nodemailer from 'nodemailer'

// Singleton transporter — reused across requests in the same process.
// Falls back to a test account stub when SMTP_HOST is not configured.
let _transporter: nodemailer.Transporter | null = null

export function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter

  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    // Dry-run: no-op transporter
    _transporter = nodemailer.createTransport({ jsonTransport: true })
    return _transporter
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  return _transporter
}
