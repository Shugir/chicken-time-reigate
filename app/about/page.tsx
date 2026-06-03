import { Oswald } from 'next/font/google'
import Link from 'next/link'

const oswald = Oswald({
  variable: '--font-oswald',
  subsets: ['latin'],
  weight: ['600', '700'],
})

const STATS = [
  { number: '50K+',  label: 'Orders Served'    },
  { number: '4.9★',  label: 'Average Rating'   },
  { number: '6+',    label: 'Years in Reigate'  },
  { number: '100%',  label: 'Fresh Daily'       },
]

const VALUES = [
  {
    num: '01', title: 'QUALITY',
    body: 'We refuse to cut corners. Every bird is fresh, every batch is timed, and every order is quality-checked before it reaches you.',
  },
  {
    num: '02', title: 'COMMUNITY',
    body: 'Reigate is our home. We hire locally, source locally where possible, and give back to the community that built us.',
  },
  {
    num: '03', title: 'CRAFT',
    body: 'Cooking is not a commodity. Our team trains for weeks before they touch a single bird. The craft matters.',
  },
]

export default function AboutPage() {
  return (
    <div className={`${oswald.variable} min-h-screen`}>

      {/* ── Hero ── */}
      <section className="relative bg-brand-dark min-h-[92vh] flex flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#fff,#fff 1px,transparent 1px,transparent 48px),' +
              'repeating-linear-gradient(90deg,#fff,#fff 1px,transparent 1px,transparent 48px)',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <p
            className="text-brand-red text-xs font-bold tracking-[0.45em] uppercase mb-8 animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            Reigate, Surrey · Est. 2018
          </p>

          <h1
            className="text-white leading-none animate-fade-up"
            style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 'clamp(72px, 16vw, 180px)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              animationDelay: '0.15s',
            }}
          >
            CHICKEN<br />
            <span className="text-brand-red">TIME</span>
          </h1>

          <div className="w-20 h-[3px] bg-brand-red mx-auto my-8" />

          <p
            className="text-gray-300 text-lg md:text-xl max-w-lg mx-auto leading-relaxed animate-fade-in"
            style={{ animationDelay: '0.35s' }}
          >
            Born in Reigate. Obsessed with flavour. Never compromising.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <span className="text-[10px] tracking-[0.35em] uppercase font-semibold">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-gray-600 to-transparent" />
        </div>
      </section>

      {/* ── Manifesto ── */}
      <section className="bg-white py-16 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-400 text-[10px] font-bold tracking-[0.5em] uppercase mb-8">Our Promise</p>
          <div style={{ lineHeight: 0.88 }}>
            {[
              { text: 'FRESH.',  color: '#1A1A1A',   stroke: 'none'               },
              { text: 'CRISPY.', color: 'transparent', stroke: '3px #E4002B'       },
              { text: 'HONEST.', color: '#E4002B',   stroke: 'none'               },
            ].map(({ text, color, stroke }) => (
              <div
                key={text}
                style={{
                  fontFamily: 'var(--font-oswald)',
                  fontSize: 'clamp(72px, 17vw, 200px)',
                  fontWeight: 700,
                  color,
                  WebkitTextStroke: stroke,
                  letterSpacing: '-0.03em',
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Story ── */}
      <section className="bg-brand-light py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Sticky year */}
          <div className="lg:sticky lg:top-10">
            <div
              style={{
                fontFamily: 'var(--font-oswald)',
                fontSize: 'clamp(96px, 20vw, 240px)',
                fontWeight: 700,
                color: 'transparent',
                WebkitTextStroke: '2px #E4002B',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              2018
            </div>
            <div className="h-[3px] w-14 bg-brand-red mt-4" />
            <p className="text-gray-500 text-xs mt-3 uppercase tracking-[0.35em] font-bold">When it all began</p>
          </div>

          {/* Body copy */}
          <div className="space-y-7">
            <blockquote className="border-l-4 border-brand-red pl-6 py-1">
              <p className="text-2xl font-bold text-brand-dark leading-snug">
                "We were tired of mediocre chicken. So we decided to change it."
              </p>
            </blockquote>
            <p className="text-gray-600 leading-relaxed text-[17px]">
              Chicken Time Reigate opened its doors in 2018 with one obsession: to serve the freshest,
              crispiest chicken in Surrey. Not frozen. Not reheated. Just whole birds, cut daily,
              coated and cooked to order.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Our founder spent three years perfecting the coating recipe — a closely guarded blend of
              spices that creates that unmistakable crunch. Every piece is hand-coated and fried in
              100% vegetable oil at the exact temperature needed for perfection.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We source our chicken from Surrey farms where possible, supporting British agriculture and
              ensuring we always know exactly what goes into your meal. Fresh produce. Honest
              ingredients. No shortcuts.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Today, we serve thousands of orders every month — but every single one still gets the
              same care and attention as that very first order in 2018.
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-brand-red py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(({ number, label }) => (
            <div key={label}>
              <div
                className="text-brand-yellow"
                style={{
                  fontFamily: 'var(--font-oswald)',
                  fontSize: 'clamp(48px, 7vw, 88px)',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {number}
              </div>
              <p className="text-white/80 text-xs font-bold mt-2 uppercase tracking-[0.3em]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Values ── */}
      <section className="bg-brand-dark py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-brand-red text-[10px] font-bold tracking-[0.5em] uppercase mb-14">What We Stand For</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {VALUES.map(({ num, title, body }) => (
              <div key={num} className="border-t border-gray-700 pt-8">
                <span
                  className="text-brand-yellow opacity-40 select-none"
                  style={{ fontFamily: 'var(--font-oswald)', fontSize: '52px', fontWeight: 700, lineHeight: 1 }}
                >
                  {num}
                </span>
                <h3
                  className="text-white mt-5 mb-3"
                  style={{ fontFamily: 'var(--font-oswald)', fontSize: '26px', fontWeight: 700, letterSpacing: '0.06em' }}
                >
                  {title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-brand-yellow py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-brand-dark mb-4"
            style={{
              fontFamily: 'var(--font-oswald)',
              fontSize: 'clamp(36px, 6vw, 66px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            READY TO TASTE THE DIFFERENCE?
          </h2>
          <p className="text-brand-dark/70 mb-10 text-lg">
            Order now and experience Reigate&apos;s freshest chicken.
          </p>
          <Link
            href="/"
            className="inline-block bg-brand-dark text-white font-black px-10 py-4 rounded-xl hover:bg-black transition-colors text-base uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-oswald)', fontSize: '18px' }}
          >
            Order Now →
          </Link>
        </div>
      </section>

    </div>
  )
}
