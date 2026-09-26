import MenuItemEditor from '@/components/admin/menu-item-editor/MenuItemEditor'

// `?from=<id>` prefills the form from an existing item (Duplicate)
export default async function NewMenuItemPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams
  const fromId = typeof from === 'string' ? from : undefined
  return <MenuItemEditor key={fromId ?? 'new'} fromId={fromId} />
}
