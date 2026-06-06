import Link from 'next/link'

const ALLERGENS = [
  { name: 'Celery',      description: 'Including celery stalks, leaves, seeds and celeriac.' },
  { name: 'Cereals containing gluten', description: 'Wheat, rye, barley, oats and their hybrids.' },
  { name: 'Crustaceans', description: 'Prawns, crabs, lobster and crayfish.' },
  { name: 'Eggs',        description: 'Including foods made with eggs such as mayonnaise.' },
  { name: 'Fish',        description: 'Including foods made with fish such as Worcestershire sauce.' },
  { name: 'Lupin',       description: 'Including lupin seeds and flour.' },
  { name: 'Milk',        description: 'Including dairy products such as cheese, butter and cream.' },
  { name: 'Molluscs',    description: 'Including mussels, oysters, squid and snails.' },
  { name: 'Mustard',     description: 'Including mustard leaves, seeds, powder and prepared mustard.' },
  { name: 'Nuts',        description: 'Almonds, cashews, hazelnuts, pecan, pistachios and walnuts.' },
  { name: 'Peanuts',     description: 'Including foods made with peanut oil.' },
  { name: 'Sesame',      description: 'Including sesame seeds and sesame oil (tahini).' },
  { name: 'Soya',        description: 'Including foods made with soya such as tofu and soy sauce.' },
  { name: 'Sulphites & Sulphur dioxide', description: 'Preservatives found in some wines, dried fruit and meat.' },
]

export default function AllergensPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <h1 className="font-heading font-black text-4xl text-brand-dark mb-3">Allergen Information</h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Our dishes may contain or come into contact with any of the 14 major allergens listed
            below. If you have a food allergy or intolerance, please inform us before ordering.
            We cannot guarantee any dish is completely allergen-free.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ALLERGENS.map(({ name, description }) => (
            <div key={name} className="rounded-xl border border-gray-100 p-4">
              <p className="font-semibold text-brand-dark text-sm mb-0.5">{name}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-gray-400 leading-relaxed">
          For detailed allergen information on a specific dish, please call us before ordering.
          Information is correct at time of publication but ingredients may change.
        </p>

        <div className="mt-8">
          <Link href="/" className="text-brand-red font-bold text-sm hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
