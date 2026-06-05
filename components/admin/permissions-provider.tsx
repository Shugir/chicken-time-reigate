'use client'

import { createContext, useContext, ReactNode } from 'react'

interface PermissionsContextType {
  email:       string
  permissions: string[]
  isOwner:     boolean
  can:         (permission: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextType>({
  email:       '',
  permissions: [],
  isOwner:     false,
  can:         () => false,
})

export function usePermissions() {
  return useContext(PermissionsContext)
}

export default function PermissionsProvider({
  children,
  email,
  permissions,
  isOwner,
}: {
  children:    ReactNode
  email:       string
  permissions: string[]
  isOwner:     boolean
}) {
  const can = (permission: string) => isOwner || permissions.includes(permission)

  return (
    <PermissionsContext.Provider value={{ email, permissions, isOwner, can }}>
      {children}
    </PermissionsContext.Provider>
  )
}
