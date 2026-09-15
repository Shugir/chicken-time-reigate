'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Loader2, Plus, Pencil, X, Check, Shield, ShieldCheck,
} from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { AdminDataTable, type Column, type FilterConfig } from '@/components/AdminDataTable'

interface StaffMember {
  id: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'kitchen' | 'driver' | 'staff'
  permissions: string[]
  created_at: string
  user_id?: string | null
}

const ALL_PERMISSIONS = [
  { key: 'Dashboard',          label: 'Dashboard',           desc: 'View stats and recent orders' },
  { key: 'MenuManager',        label: 'Menu Manager',        desc: 'Add, edit and delete menu items' },
  { key: 'Categories',         label: 'Categories',          desc: 'Manage menu categories and display order' },
  { key: 'StoreSettings',      label: 'Store Settings',      desc: 'Toggle store open/closed and prep time' },
  { key: 'DeliveryZones',      label: 'Delivery Zones',      desc: 'Manage delivery areas and fees' },
  { key: 'Promotions',         label: 'Promotions',          desc: 'Create and manage discount codes' },
  { key: 'Deals',              label: 'Deals',                desc: 'Create and manage BOGO, bundle, meal and order-wide deals' },
  { key: 'Fleet',              label: 'Fleet & Drivers',     desc: 'Manage drivers and wages' },
  { key: 'Kitchen',            label: 'Kitchen Display',     desc: 'Access the kitchen order dashboard' },
  { key: 'DispatchController', label: 'Dispatch Controller', desc: 'Manage out-for-delivery orders' },
  { key: 'Driver',             label: 'Driver',              desc: 'Access the driver delivery dashboard' },
  { key: 'UserControl',        label: 'User Control',        desc: 'Manage staff accounts and permissions' },
  { key: 'Loyalty',            label: 'Loyalty Points',      desc: 'View and adjust customer loyalty balances' },
  { key: 'Receipts',           label: 'Receipts',            desc: 'View full order history, receipts and CSV export' },
]

interface StaffForm {
  email:       string
  role:        'owner' | 'admin' | 'manager' | 'kitchen' | 'driver' | 'staff'
  permissions: string[]
}

const EMPTY_FORM: StaffForm = { email: '', role: 'staff', permissions: [] }

export default function StaffPage() {
  const searchParams = useSearchParams()
  const q    = searchParams.get('q') ?? ''
  const role = searchParams.get('role') ?? ''

  const [staff, setStaff]         = useState<StaffMember[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<StaffMember | null>(null)
  const [form, setForm]           = useState<StaffForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)

  async function fetchStaff() {
    setLoading(true)
    const sp = new URLSearchParams()
    if (q)    sp.set('q', q)
    if (role) sp.set('role', role)
    const res = await fetch(`/api/admin/staff?${sp}`)
    if (res.ok) setStaff(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchStaff() }, [q, role])

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setSaveError(''); setShowForm(true)
  }

  function openEdit(member: StaffMember) {
    setEditing(member)
    setForm({ email: member.email, role: member.role, permissions: [...member.permissions] })
    setSaveError(''); setShowForm(true)
  }

  function togglePermission(key: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }))
  }

  async function handleSave() {
    if (!form.email.trim()) { setSaveError('Email is required'); return }
    setSaving(true); setSaveError('')
    try {
      const body = editing
        ? { role: form.role, permissions: form.permissions }
        : { email: form.email.trim(), role: form.role, permissions: form.permissions }
      const res = editing
        ? await fetch(`/api/admin/staff/${editing.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : await fetch('/api/admin/staff', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
      if (!res.ok) { setSaveError((await res.json()).error ?? 'Save failed'); return }
      await fetchStaff()
      setShowForm(false); setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/admin/staff/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    await fetchStaff()
  }

  const columns: Column<StaffMember>[] = [
    {
      key: 'email',
      label: 'Email',
      render: (member) => (
        <div className="flex items-center gap-2">
          {member.role === 'owner'
            ? <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            : <Shield className="w-4 h-4 text-zinc-600 shrink-0" />
          }
          <span className="text-white font-medium">{member.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (member) => {
        const roleColors: Record<string, string> = {
          owner:   'bg-amber-500/20 text-amber-400',
          admin:   'bg-purple-500/20 text-purple-400',
          manager: 'bg-blue-500/20 text-blue-400',
          kitchen: 'bg-orange-500/20 text-orange-400',
          driver:  'bg-green-500/20 text-green-400',
          staff:   'bg-zinc-700/60 text-zinc-300',
        }
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleColors[member.role] ?? 'bg-zinc-700/60 text-zinc-300'}`}>
            {member.role}
          </span>
        )
      },
    },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (member) => member.role === 'owner' ? (
        <span className="text-xs text-zinc-500 italic">All permissions</span>
      ) : member.permissions.length === 0 ? (
        <span className="text-xs text-zinc-600">No permissions</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {member.permissions.slice(0, 4).map((p) => (
            <span key={p} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
              {ALL_PERMISSIONS.find((x) => x.key === p)?.label ?? p}
            </span>
          ))}
          {member.permissions.length > 4 && (
            <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-600">
              +{member.permissions.length - 4}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (member) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => openEdit(member)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setDeleteTarget(member)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ]

  const roleFilter: FilterConfig = {
    paramKey: 'role',
    allLabel: 'All Roles',
    options: [
      { label: 'Owner',   value: 'owner' },
      { label: 'Admin',   value: 'admin' },
      { label: 'Manager', value: 'manager' },
      { label: 'Kitchen', value: 'kitchen' },
      { label: 'Driver',  value: 'driver' },
      { label: 'Staff',   value: 'staff' },
    ],
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">User Control Panel</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Manage staff accounts and page permissions</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Invite Staff
          </button>
        </header>

        <div className="flex-1 px-8 py-8 overflow-auto">
          <AdminDataTable
            columns={columns}
            data={staff}
            loading={loading}
            searchPlaceholder="Search by email…"
            filters={[roleFilter]}
            emptyIcon={<Shield className="w-12 h-12" />}
            emptyText={q || role ? 'No staff match your filters' : 'No staff accounts yet'}
            keyExtractor={(m) => m.id}
          />
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={!!editing}
                  placeholder="staff@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-red disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffForm['role'] }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red appearance-none"
                >
                  <option value="staff">Staff (custom permissions)</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="driver">Driver</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner (full access)</option>
                </select>
              </div>

              {form.role !== 'owner' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-3">Page Access</label>
                  <div className="space-y-2">
                    {ALL_PERMISSIONS.map((perm) => {
                      const enabled = form.permissions.includes(perm.key)
                      return (
                        <button
                          key={perm.key}
                          onClick={() => togglePermission(perm.key)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                            enabled
                              ? 'bg-brand-red/10 border-brand-red/30'
                              : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            enabled ? 'bg-brand-red border-brand-red' : 'border-zinc-600'
                          }`}>
                            {enabled && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${enabled ? 'text-white' : 'text-zinc-400'}`}>
                              {perm.label}
                            </p>
                            <p className="text-xs text-zinc-600">{perm.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {saveError && <p className="text-sm text-red-400">{saveError}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-red hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editing ? 'Save Changes' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-white mb-2">Remove staff member?</h2>
            <p className="text-sm text-zinc-500 mb-5">{deleteTarget.email} will lose all access immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
