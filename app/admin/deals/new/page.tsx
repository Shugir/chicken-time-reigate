import DealEditor from '@/components/admin/deal-editor/DealEditor'

// `?type=bogo|bundle|order_discount` picks the kind of deal to create
export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams
  const t = typeof type === 'string' ? type : undefined
  return <DealEditor key={t ?? 'new'} type={t} />
}
