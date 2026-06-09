'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

export interface Column<T> {
  key: string
  label: string
  headerClassName?: string
  cellClassName?: string
  render: (row: T) => React.ReactNode
}

export interface FilterConfig {
  paramKey: string
  allLabel?: string
  options: { label: string; value: string }[]
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  searchPlaceholder?: string
  searchKey?: string
  filters?: FilterConfig[]
  pageSize?: number
  emptyText?: string
  emptyIcon?: React.ReactNode
  emptyNode?: React.ReactNode
  hideSearch?: boolean
  keyExtractor: (row: T) => string
}

const DEFAULT_PAGE_SIZE = 25

export function AdminDataTable<T>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Search…',
  searchKey = 'q',
  filters = [],
  pageSize = DEFAULT_PAGE_SIZE,
  emptyText = 'No results',
  emptyIcon,
  emptyNode,
  hideSearch = false,
  keyExtractor,
}: Props<T>) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const currentQuery = searchParams.get(searchKey) ?? ''
  const [inputValue, setInputValue] = useState(currentQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setInputValue(searchParams.get(searchKey) ?? '')
  }, [searchParams, searchKey])

  const currentPage = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    if (key !== 'page') params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleSearchChange(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateParam(searchKey, value), 350)
  }

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pageData = data.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      {!hideSearch && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand-red focus:border-brand-red"
            />
          </div>

          {filters.map((filter) => {
            const active = searchParams.get(filter.paramKey) ?? ''
            return (
              <div key={filter.paramKey} className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => updateParam(filter.paramKey, '')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    !active
                      ? 'bg-brand-red text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {filter.allLabel ?? 'All'}
                </button>
                {filter.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateParam(filter.paramKey, opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active === opt.value
                        ? 'bg-brand-red text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-zinc-800/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex gap-4">
                {columns.map((col) => (
                  <div key={col.key} className="h-4 rounded bg-zinc-800 animate-pulse flex-1" />
                ))}
              </div>
            ))}
          </div>
        ) : pageData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-3">
            {emptyNode ?? (
              <>
                {emptyIcon && <div className="opacity-40">{emptyIcon}</div>}
                <p className="text-sm">{emptyText}</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide ${col.headerClassName ?? 'text-left'}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {pageData.map((row) => (
                  <tr key={keyExtractor(row)} className="hover:bg-zinc-800/30 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className={`px-5 py-3.5 ${col.cellClassName ?? ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, data.length)} of {data.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateParam('page', String(safePage - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono tabular-nums">{safePage} / {totalPages}</span>
            <button
              onClick={() => updateParam('page', String(safePage + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
