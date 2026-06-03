import Link from 'next/link'
import { Oswald } from 'next/font/google'
import { ChevronRight, Flame, Leaf, Truck } from 'lucide-react'

const oswald = Oswald({
  variable: '--font-oswald',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

// ─── Data ─────────────────────────────────────────────────────────────────────

const POPULAR = [
  {
    emoji: '🍔',
    name: 'Spicy Double Stack',
    desc: 'Two crispy fillets · jalapeños · pepper jack · chipotle',
    price: '£11.49',
    tag: 'HOT',
    tagColor: 'bg-brand-red',
  },
  {
    emoji: '🍗',
    name: 'Korean Glaze Wings',
    desc: 'Gochujang & honey glaze · toasted sesame · spring onion',
    price: '£10.99',
    tag: 'POPULAR',
    tagColor: 'bg-amber-500',
  },
  {
    emoji: '🍔',
    name: 'BBQ Crunch Burger',
    desc: 'Crispy thigh · streaky bacon · BBQ sauce · crispy onions',
    price: '£10.49',
    tag: null,
    tagColor: '',
  },
  {
    emoji: '🍟',
    name: 'Loaded Fries',
    desc: 'Crinkle fries · cheese sauce · bacon bits · spring onion',
    price: '£5.49',
    tag: 'POPULAR',
    tagColor: 'bg-amber-500',
  },
  {
    emoji: '🍗',
    name: 'Buffalo Wings (6pc)',
    desc: 'Classic buffalo sauce · blue cheese dip · celery sticks',
    price: '£7.99',
    tag: null,
    tagColor: '',
  },
]

const REASONS = [
  {
    Icon: Leaf,
    number: '01',
    title: 'FRESH EVERY DAY',
    body: 'Whole birds arrive each morning. Nothing frozen, nothing reheated — every piece cut and coated to order.',
  },
  {
    Icon: Flame,
    number: '02',
    title: 'COOKED TO ORDER',
    body: 'We cook when you order. Not a minute before. That crunch you hear when you open the box? That\'s proof.',
  },
  {
    Icon: Truck,
    number: '03',
    title: '25 MIN DELIVERY',
    body: 'Fast across Reigate, every time. Free delivery on orders over £20. No cold food. No excuses.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className={`${oswald.variable} bg-[#0A0A0A] text-white`}>

      {/* Page-scoped keyframes */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(228,0,43,0.7), 0 0 30px rgba(228,0,43,0.15); }
          50%       { box-shadow: 0 0 0 16px rgba(228,0,43,0), 0 0 60px rgba(228,0,43,0.35); }
        }
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes float-bob {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-20px) rotate(2deg); }
        }
        @keyframes grain-shift {
          0%, 100% { transform: translate(0,0); }
          20%       { transform: translate(-2%,-3%); }
          40%       { transform: translate(3%,1%); }
          60%       { transform: translate(-1%,4%); }
          80%       { transform: translate(2%,-2%); }
        }
        .pulse-btn  { animation: pulse-glow 2.6s ease-in-out infinite; }
        .marquee-track { animation: marquee-scroll 24s linear infinite; }
        .float-emoji { animation: float-bob 7s ease-in-out infinite; }
        .grain-layer::after {
          content: '';
          position: absolute;
          inset: -200%;
          width: 400%;
          height: 400%;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.04;
          pointer-events: none;
          animation: grain-shift 0.4s steps(1) infinite;
        }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="grain-layer relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden">

        {/* Heat glow from bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 100% 70% at 50% 115%, rgba(228,0,43,0.28) 0%, rgba(255,80,0,0.10) 35%, transparent 65%)',
          }}
        />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#fff,#fff 1px,transparent 1px,transparent 80px),' +
              'repeating-linear-gradient(90deg,#fff,#fff 1px,transparent 1px,transparent 80px)',
          }}
        />

        {/* Decorative ghost letterform */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none" aria-hidden>
          <span
            style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 'clamp(180px, 45vw, 580px)',
              fontWeight: 700,
              color: 'transparent',
              WebkitTextStroke: '1px rgba(255,255,255,0.03)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            CRISPY
          </span>
        </div>

        {/* Main content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">

          {/* Floating hero emoji */}
          <div className="float-emoji text-[6.5rem] leading-none mb-10 select-none" aria-hidden>
            🍗
          </div>

          {/* Overline */}
          <p
            className="text-brand-red text-[11px] font-bold tracking-[0.55em] uppercase mb-7 animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            Reigate · Est. 2018 · Open Now
          </p>

          {/* Main headline */}
          <h1
            className="text-white animate-fade-up"
            style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 'clamp(54px, 14vw, 160px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
              animationDelay: '0.15s',
            }}
          >
            THE BEST<br />
            <span className="text-brand-red">CRISPY CHICKEN</span><br />
            IN REIGATE.
          </h1>

          {/* Divider line */}
          <div className="w-16 h-[3px] bg-brand-red mx-auto mt-10 mb-8 animate-fade-in" style={{ animationDelay: '0.3s' }} />

          {/* Subtitle */}
          <p
            className="text-gray-400 text-lg md:text-xl max-w-md mx-auto leading-relaxed animate-fade-in"
            style={{ animationDelay: '0.35s' }}
          >
            Fresh birds. Secret coating. Cooked the moment you order.
            Delivering joy across Reigate since 2018.
          </p>

          {/* CTA */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 animate-fade-in"
            style={{ animationDelay: '0.5s' }}
          >
            <Link
              href="/order"
              className="pulse-btn group flex items-center gap-3 bg-brand-red hover:bg-red-700 active:bg-red-800 text-white font-black px-12 py-5 rounded-xl transition-colors"
              style={{ fontFamily: 'var(--font-oswald)', fontSize: '22px', letterSpacing: '0.1em' }}
            >
              ORDER NOW
              <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/about"
              className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-[0.25em] hover:underline underline-offset-4 transition-colors"
            >
              Our Story →
            </Link>
          </div>

          {/* Trust row */}
          <div
            className="flex items-center justify-center gap-10 mt-16 pb-4 animate-fade-in"
            style={{ animationDelay: '0.7s' }}
          >
            {[
              { val: '4.9★', label: 'Avg Rating' },
              { val: '50K+', label: 'Orders Served' },
              { val: '25min', label: 'Est. Delivery' },
            ].map(({ val, label }) => (
              <div key={label} className="text-center">
                <div
                  className="text-brand-yellow"
                  style={{ fontFamily: 'var(--font-oswald)', fontSize: '30px', fontWeight: 700, lineHeight: 1 }}
                >
                  {val}
                </div>
                <p className="text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold mt-1.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-700 animate-fade-in" style={{ animationDelay: '1.2s' }}>
          <span className="text-[9px] tracking-[0.45em] uppercase font-bold">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-gray-700 to-transparent" />
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────────────── */}
      <div className="bg-brand-red py-3.5 overflow-hidden" aria-hidden>
        <div className="marquee-track flex whitespace-nowrap select-none">
          {[0, 1].map((i) => (
            <span key={i} className="flex shrink-0 items-center">
              {['FRESH DAILY', '·', 'COOKED TO ORDER', '·', 'FREE DELIVERY OVER £20', '·', "REIGATE'S FINEST", '·', 'EST. 2018', '·', 'CRISPY EVERY TIME', '·'].map((text, j) => (
                <span
                  key={j}
                  className={`px-5 text-sm font-black ${text === '·' ? 'text-red-300/60' : 'text-white'}`}
                  style={{ fontFamily: 'var(--font-oswald)', letterSpacing: text === '·' ? '0' : '0.14em' }}
                >
                  {text}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── WHY CHOOSE US ────────────────────────────────────────────── */}
      <section className="bg-[#0D0D0D] py-28 px-6">
        <div className="max-w-6xl mx-auto">

          <div className="mb-16">
            <p className="text-brand-red text-[10px] font-bold tracking-[0.55em] uppercase mb-6">Why Choose Us</p>
            <h2
              className="text-white"
              style={{
                fontFamily: 'var(--font-oswald)',
                fontSize: 'clamp(42px, 8vw, 96px)',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                lineHeight: 0.92,
              }}
            >
              NO SHORTCUTS.<br />
              <span className="text-brand-red">EVER.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border border-white/[0.08] rounded-2xl overflow-hidden">
            {REASONS.map(({ Icon, number, title, body }, i) => (
              <div
                key={number}
                className={`relative p-10 group hover:bg-white/[0.025] transition-colors duration-300 ${
                  i < 2 ? 'border-b md:border-b-0 md:border-r border-white/[0.08]' : ''
                }`}
              >
                {/* Hover accent */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-brand-red/0 group-hover:bg-brand-red/40 transition-colors duration-300" />

                <div className="flex items-start justify-between mb-8">
                  <div className="w-11 h-11 rounded-xl bg-brand-red/10 flex items-center justify-center">
                    <Icon size={20} className="text-brand-red" />
                  </div>
                  <span
                    className="text-white/[0.06] select-none leading-none"
                    style={{ fontFamily: 'var(--font-oswald)', fontSize: '56px', fontWeight: 700 }}
                  >
                    {number}
                  </span>
                </div>

                <h3
                  className="text-white mb-4"
                  style={{ fontFamily: 'var(--font-oswald)', fontSize: '20px', fontWeight: 700, letterSpacing: '0.08em' }}
                >
                  {title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POPULAR ITEMS ────────────────────────────────────────────── */}
      <section className="bg-[#0A0A0A] py-28 px-6">
        <div className="max-w-6xl mx-auto">

          <div className="flex items-end justify-between gap-4 mb-14">
            <div>
              <p className="text-brand-red text-[10px] font-bold tracking-[0.55em] uppercase mb-6">Fan Favourites</p>
              <h2
                className="text-white"
                style={{
                  fontFamily: 'var(--font-oswald)',
                  fontSize: 'clamp(38px, 7vw, 80px)',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  lineHeight: 0.92,
                }}
              >
                WHAT REIGATE<br />
                <span className="text-brand-red">CAN&apos;T STOP ORDERING.</span>
              </h2>
            </div>
            <Link
              href="/order"
              className="hidden md:flex shrink-0 items-center gap-2 border border-white/[0.15] hover:border-brand-red text-gray-400 hover:text-brand-red text-xs font-black px-5 py-3 rounded-xl transition-all duration-200"
              style={{ fontFamily: 'var(--font-oswald)', letterSpacing: '0.1em' }}
            >
              FULL MENU <ChevronRight size={15} />
            </Link>
          </div>

          {/* Horizontal scroll carousel */}
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
            {POPULAR.map((item) => (
              <Link
                key={item.name}
                href="/order"
                className="snap-start shrink-0 w-[280px] md:w-72 bg-[#161616] border border-white/[0.08] hover:border-brand-red/50 rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-brand-red/10"
              >
                {/* Emoji area */}
                <div className="relative h-48 bg-[#1C1C1C] flex items-center justify-center overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse 90% 90% at 50% 130%, rgba(228,0,43,0.18) 0%, transparent 70%)',
                    }}
                  />
                  <span className="text-[90px] leading-none select-none group-hover:scale-110 transition-transform duration-500">
                    {item.emoji}
                  </span>
                  {item.tag && (
                    <span
                      className={`absolute top-3 left-3 ${item.tagColor} text-white text-[10px] font-black px-2.5 py-1 rounded-full`}
                      style={{ fontFamily: 'var(--font-oswald)', letterSpacing: '0.12em' }}
                    >
                      {item.tag}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3
                    className="text-white mb-2"
                    style={{ fontFamily: 'var(--font-oswald)', fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em' }}
                  >
                    {item.name}
                  </h3>
                  <p className="text-gray-600 text-xs leading-relaxed mb-5">{item.desc}</p>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-brand-yellow"
                      style={{ fontFamily: 'var(--font-oswald)', fontSize: '24px', fontWeight: 700 }}
                    >
                      {item.price}
                    </span>
                    <span
                      className="flex items-center gap-1 text-brand-red text-[11px] font-black group-hover:gap-2 transition-all"
                      style={{ fontFamily: 'var(--font-oswald)', letterSpacing: '0.1em' }}
                    >
                      ORDER <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex md:hidden justify-center">
            <Link
              href="/order"
              className="flex items-center gap-2 border border-white/[0.15] hover:border-brand-red text-gray-400 hover:text-brand-red text-xs font-black px-6 py-3 rounded-xl transition-all"
              style={{ fontFamily: 'var(--font-oswald)', letterSpacing: '0.1em' }}
            >
              SEE FULL MENU <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="relative bg-brand-red py-28 px-6 overflow-hidden text-center">
        {/* Diagonal hatching */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 1px, transparent 1px, transparent 30px)',
          }}
        />

        {/* Ghost word backdrop */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none" aria-hidden>
          <span
            style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 'clamp(130px, 32vw, 400px)',
              fontWeight: 700,
              color: 'rgba(0,0,0,0.14)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            ORDER
          </span>
        </div>

        <div className="relative z-10 max-w-2xl mx-auto">
          <h2
            className="text-white"
            style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 'clamp(56px, 14vw, 140px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
            }}
          >
            HUNGRY?
          </h2>
          <p className="text-white/65 text-lg mt-5 mb-12">
            Order online. Collect or delivered. Always fresh, always crispy.
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-3 bg-white hover:bg-gray-100 active:bg-gray-200 text-brand-red font-black px-14 py-5 rounded-xl transition-colors shadow-2xl shadow-red-900/40"
            style={{ fontFamily: 'var(--font-oswald)', fontSize: '22px', letterSpacing: '0.1em' }}
          >
            ORDER NOW <ChevronRight size={22} />
          </Link>
          <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] mt-8 font-bold">
            Free delivery over £20 · Est. 25–35 min · Reigate
          </p>
        </div>
      </section>

    </div>
  )
}
