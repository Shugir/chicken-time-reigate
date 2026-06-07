import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { StoreStatusBanner } from "@/components/StoreStatusBanner";
import { Footer } from "@/components/Footer";
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

        <StoreStatusBanner />
        <SiteHeader />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

        <main className="flex-1 min-h-[60vh]">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
