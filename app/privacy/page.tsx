import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <h1 className="font-heading font-black text-4xl text-brand-dark mb-3">Privacy Policy</h1>
        <p className="text-gray-500 text-base mb-8">
          Our full privacy policy is coming soon. If you have any questions about how we handle
          your data, please contact us directly.
        </p>
        <Link href="/" className="text-brand-red font-bold text-sm hover:underline">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
