import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { NewsletterForm } from "@/components/NewsletterForm";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Chicken Time Reigate",
  description: "Fresh, crispy chicken delivered fast in Reigate. Order burgers, wings, sides and drinks.",
};

const QUICK_LINKS = [
  { label: "Home",     href: "/" },
  { label: "Our Menu", href: "/order" },
  { label: "About",    href: "/about" },
  { label: "Contact",  href: "/contact" },
];

const HOURS = [
  { day: "Mon – Thu", hours: "11:00 – 22:00" },
  { day: "Friday",    hours: "11:00 – 23:00" },
  { day: "Saturday",  hours: "11:00 – 23:00" },
  { day: "Sunday",    hours: "12:00 – 21:00" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-brand-dark" suppressHydrationWarning>

        <SiteHeader />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

        <main className="flex-1 min-h-[60vh]">
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="bg-brand-dark text-white">

          {/* Main footer grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Brand column */}
            <div className="space-y-4">
              <Link href="/" className="flex items-center">
                <Image
                  src="/chicken-time-logo_v1.png"
                  alt="Chicken Time Reigate Logo"
                  width={700}
                  height={150}
                  className="h-24 w-auto"
                />
              </Link>
              <p className="text-sm text-white/60 leading-relaxed max-w-[220px]">
                Fresh, crispy chicken made to order. Proudly serving Reigate since 2019.
              </p>
              <p className="text-xs text-white/40">
                📍 High Street, Reigate, Surrey RH2 9AZ
              </p>
            </div>

            {/* Quick links */}
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-white/50">
                Quick Links
              </h3>
              <ul className="space-y-2">
                {QUICK_LINKS.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-white/70 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Operating hours */}
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-white/50">
                Opening Hours
              </h3>
              <ul className="space-y-2">
                {HOURS.map(({ day, hours }) => (
                  <li key={day} className="flex justify-between gap-4 text-sm">
                    <span className="text-white/60">{day}</span>
                    <span className="text-white font-semibold tabular-nums">{hours}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-white/40 pt-1">
                Last orders 30 min before close
              </p>
            </div>

            {/* Newsletter */}
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-white/50">
                Stay in the Loop
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                New deals, limited drops, and crispy news straight to your inbox.
              </p>
              <NewsletterForm />
            </div>

          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/35">
              <p suppressHydrationWarning>© {new Date().getFullYear()} Chicken Time Reigate. All rights reserved.</p>
              <div className="flex gap-5">
                <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
                <Link href="/terms"   className="hover:text-white/60 transition-colors">Terms</Link>
                <Link href="/allergens" className="hover:text-white/60 transition-colors">Allergens</Link>
              </div>
            </div>
          </div>

        </footer>
      </body>
    </html>
  );
}
