type PaginationControlsProps = {
  ariaLabel: string
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageIndex: number
  totalPages: number
  onPageChange: (pageNumber: number) => void
}

export function PaginationControls({
  ariaLabel,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  pageIndex,
  totalPages,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null
  }

  // Shared paging prevents every page from inventing a different next/previous behavior.
  return (
    <section className="pagination-row" aria-label={ariaLabel}>
      <button
        className="ui-button ui-button-secondary compact"
        disabled={!hasPreviousPage}
        onClick={() => onPageChange(Math.max(1, pageIndex - 1))}
        type="button"
      >
        Evvelki
      </button>
      <strong>
        {pageIndex} / {totalPages}
      </strong>
      <button
        className="ui-button ui-button-secondary compact"
        disabled={!hasNextPage}
        onClick={() => onPageChange(pageIndex + 1)}
        type="button"
      >
        Novbeti
      </button>
    </section>
  )
}
