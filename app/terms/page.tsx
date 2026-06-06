import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <h1 className="font-heading font-black text-4xl text-brand-dark mb-3">Terms of Service</h1>
        <p className="text-gray-500 text-base mb-8">
          Our full terms of service are coming soon. By using Chicken Time Reigate, you agree to
          our standard food ordering terms. Contact us if you have any questions.
        </p>
        <Link href="/" className="text-brand-red font-bold text-sm hover:underline">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}
