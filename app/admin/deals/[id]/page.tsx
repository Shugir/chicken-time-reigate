import DealEditor from '@/components/admin/deal-editor/DealEditor'

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DealEditor key={id} dealId={id} />
}
