import { ChevronLeft, ChevronRight } from 'lucide-react'

type PaginationControlsProps = {
  ariaLabel: string
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageIndex: number
  pageSize?: number
  pageSizeOptions?: number[]
  totalCount?: number
  totalPages: number
  onPageChange: (pageNumber: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

function visiblePages(pageIndex: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (pageIndex <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages] as const
  }

  if (pageIndex >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [1, 'ellipsis-left', pageIndex - 1, pageIndex, pageIndex + 1, 'ellipsis-right', totalPages] as const
}

export function PaginationControls({
  ariaLabel,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  onPageSizeChange,
  pageIndex,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  totalCount,
  totalPages,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null
  }

  const pages = visiblePages(pageIndex, totalPages)
  const shownCount = totalCount && pageSize ? Math.min(pageSize, Math.max(totalCount - (pageIndex - 1) * pageSize, 0)) : undefined

  // One shared paginator keeps list pages predictable and prevents page-specific drift.
  return (
    <section className="pagination-row pagination-modern" aria-label={ariaLabel}>
      <button
        className="pagination-arrow"
        disabled={!hasPreviousPage}
        aria-label="Əvvəlki səhifə"
        onClick={() => onPageChange(Math.max(1, pageIndex - 1))}
        type="button"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="pagination-pages">
        {pages.map((page) =>
          typeof page === 'number' ? (
            <button
              key={page}
              type="button"
              className={`pagination-page${page === pageIndex ? ' active' : ''}`}
              aria-current={page === pageIndex ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ) : (
            <span key={page} className="pagination-ellipsis">
              ...
            </span>
          ),
        )}
      </div>
      <button
        className="pagination-arrow"
        disabled={!hasNextPage}
        aria-label="Növbəti səhifə"
        onClick={() => onPageChange(pageIndex + 1)}
        type="button"
      >
        <ChevronRight size={16} />
      </button>
      {totalCount !== undefined && shownCount !== undefined ? (
        <span className="pagination-summary">
          {totalCount} qeyddən {shownCount} ədəd göstər
        </span>
      ) : null}
      {pageSize !== undefined && onPageSizeChange ? (
        <select className="pagination-size-select" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label="Səhifə ölçüsü">
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : null}
    </section>
  )
}
