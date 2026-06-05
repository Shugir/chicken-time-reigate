'use client'

import { createContext, useContext, ReactNode } from 'react'

interface PermissionsContextType {
  permissions: string[]
  isOwner:     boolean
  can:         (permission: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  isOwner:     false,
  can:         () => false,
})

export function usePermissions() {
  return useContext(PermissionsContext)
}

export default function PermissionsProvider({
  children,
  permissions,
  isOwner,
}: {
  children:    ReactNode
  permissions: string[]
  isOwner:     boolean
}) {
  const can = (permission: string) => isOwner || permissions.includes(permission)

  return (
    <PermissionsContext.Provider value={{ permissions, isOwner, can }}>
      {children}
    </PermissionsContext.Provider>
  )
}
