'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, Users, Truck } from 'lucide-react'
import AdminSidebar from '@/components/admin/admin-sidebar'

interface AuthUser {
  id: string
  email: string
}

interface Driver {
  id: string
  name: string
  user_id: string | null
}

export default function UsersPage() {
  const [users, setUsers]     = useState<AuthUser[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [usersRes, driversRes] = await Promise.all([
        fetch('/api/admin/auth-users'),
        fetch('/api/admin/drivers'),
      ])
      if (usersRes.ok)   setUsers(await usersRes.json())
      if (driversRes.ok) {
        const json = await driversRes.json()
        setDrivers(json.drivers ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  // Build user_id → driver map for O(1) lookup
  const driverByUserId = new Map<string, Driver>()
  for (const d of drivers) {
    if (d.user_id) driverByUserId.set(d.user_id, d)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h1 className="text-xl font-bold text-white">Auth Users</h1>
            <p className="text-sm text-zinc-500 mt-0.5">All registered accounts and their linked driver profiles</p>
          </div>
        </header>

        <div className="flex-1 px-8 py-8 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
              <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-medium">No users found</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/60">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">User ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wide">Linked Driver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {users.map((user) => {
                      const driver = driverByUserId.get(user.id)
                      return (
                        <tr key={user.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-6 py-3.5">
                            <span className="text-white font-medium">{user.email}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="font-mono text-xs text-zinc-600">{user.id}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            {driver ? (
                              <Link
                                href={`/admin/drivers/${driver.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors"
                              >
                                <Truck className="w-3 h-3" />
                                {driver.name}
                              </Link>
                            ) : (
                              <span className="text-xs text-zinc-700 italic">Unassigned</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
