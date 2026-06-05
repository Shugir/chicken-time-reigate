'use client'

import { useState, useEffect } from 'react'
import {
  Loader2, Plus, Pencil, X, Check, ChevronUp, ChevronDown,
  Layers, Eye, EyeOff,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

interface Category {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
  image_url: string | null
  description: string | null
  created_at: string
}

interface CategoryForm {
  name: string
  slug: string
  image_url: string
  description: string
}

const EMPTY_FORM: CategoryForm = { name: '', slug: '', image_url: '', description: '' }

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Category | null>(null)
  const [form, setForm]             = useState<CategoryForm>(EMPTY_FORM)
  const [slugLocked, setSlugLocked] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  async function fetchCategories() {
    const res = await fetch('/api/admin/categories')
    if (res.ok) setCategories(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setSlugLocked(false); setSaveError(''); setShowForm(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, slug: cat.slug, image_url: cat.image_url ?? '', description: cat.description ?? '' })
    setSlugLocked(true); setSaveError(''); setShowForm(true)
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, ...(slugLocked ? {} : { slug: slugify(name) }) }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Name is required'); return }
    if (!form.slug.trim()) { setSaveError('Slug is required'); return }
    setSaving(true); setSaveError('')
    try {
      const body = {
        name: form.name.trim(), slug: form.slug.trim(),
        image_url: form.image_url.trim() || null,
        description: form.description.trim() || null,
      }
      const res = editing
        ? await fetch(`/api/admin/categories/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { setSaveError((await res.json()).error ?? 'Save failed'); return }
      await fetchCategories()
      setShowForm(false)
    } finally { setSaving(false) }
  }

  async function handleToggle(cat: Category) {
    await fetch(`/api/admin/categories/${cat.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !cat.is_active }),
    })
    await fetchCategories()
  }

  async function handleMove(cat: Category, direction: 'up' | 'down') {
    const idx = categories.findIndex((c) => c.id === cat.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= categories.length) return
    const other = categories[swapIdx]
    await Promise.all([
      fetch(`/api/admin/categories/${cat.id}`,   { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: other.sort_order }) }),
      fetch(`/api/admin/categories/${other.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: cat.sort_order }) }),
    ])
    await fetchCategories()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/admin/categories/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    await fetchCategories()
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Categories</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Manage menu categories and their display order</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </header>

        <div className="flex-1 px-8 py-8 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
              <Layers className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-medium">No categories yet</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide w-20">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {categories.map((cat, idx) => (
                    <tr key={cat.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleMove(cat, 'up')} disabled={idx === 0} className="p-1 rounded text-zinc-600 hover:text-white hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleMove(cat, 'down')} disabled={idx === categories.length - 1} className="p-1 rounded text-zinc-600 hover:text-white hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-white font-medium">{cat.name}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{cat.slug}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <button onClick={() => handleToggle(cat)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${cat.is_active ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-zinc-700/60 text-zinc-400 hover:bg-zinc-700'}`}>
                          {cat.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {cat.is_active ? 'Active' : 'Hidden'}
                        </button>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(cat)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Name *</label>
                <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Desserts" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Slug *</label>
                <input type="text" value={form.slug} onChange={(e) => { setSlugLocked(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })) }} placeholder="e.g. desserts" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red" />
                <p className="text-xs text-zinc-600 mt-1">Must match the category field stored on menu items.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short tagline shown on storefront" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Image URL</label>
                <input type="url" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://images.unsplash.com/..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red" />
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-red hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editing ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-white mb-2">Delete &quot;{deleteTarget.name}&quot;?</h2>
            <p className="text-sm text-zinc-500 mb-5">Menu items assigned this category will no longer appear in any section.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
