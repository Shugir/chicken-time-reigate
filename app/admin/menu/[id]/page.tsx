import MenuItemEditor from '@/components/admin/menu-item-editor/MenuItemEditor'

export default async function EditMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MenuItemEditor key={id} itemId={id} />
}
