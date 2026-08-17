import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100],
  itemLabel = 'items',
}) => {
  if (totalItems === 0) return null;

  const isAll = pageSize >= totalItems && pageSize > 1000;
  const effectivePageSize = isAll ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = (safeCurrentPage - 1) * effectivePageSize + 1;
  const endItem = Math.min(safeCurrentPage * effectivePageSize, totalItems);

  // Generate page numbers range to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, safeCurrentPage - 2);
      let end = Math.min(totalPages, safeCurrentPage + 2);

      if (safeCurrentPage <= 3) {
        start = 1;
        end = 5;
      } else if (safeCurrentPage >= totalPages - 2) {
        start = totalPages - 4;
        end = totalPages;
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '12px 18px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(15, 23, 42, 0.65)',
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
        userSelect: 'none',
      }}
    >
      {/* Left: Item Range & Page Summary Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span
          className="badge"
          style={{
            background: 'rgba(0, 240, 255, 0.12)',
            color: 'var(--accent-cyan)',
            borderColor: 'rgba(0, 240, 255, 0.3)',
            fontWeight: 700,
            fontSize: '0.78rem',
            padding: '3px 10px',
            borderRadius: '6px',
          }}
        >
          Page {safeCurrentPage} of {totalPages}
        </span>

        <span style={{ fontSize: '0.8rem' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{startItem}–{endItem}</strong> of{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Right: Controls (Page size selector + Page navigation buttons) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Rows per page:</span>
          <select
            className="search-input"
            style={{
              padding: '4px 8px',
              fontSize: '0.78rem',
              borderRadius: '6px',
              cursor: 'pointer',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            value={isAll ? 999999 : pageSize}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onPageSizeChange(val);
              onPageChange(1);
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} rows
              </option>
            ))}
            <option value={999999}>All ({totalItems})</option>
          </select>
        </div>

        {/* Page Nav Buttons (Always Visible) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* First Page */}
          <button
            className="action-btn"
            disabled={safeCurrentPage <= 1}
            onClick={() => onPageChange(1)}
            style={{
              padding: '4px 7px',
              fontSize: '0.75rem',
              opacity: safeCurrentPage <= 1 ? 0.4 : 1,
              cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
            }}
            title="First Page (1)"
          >
            <ChevronsLeft size={14} />
          </button>

          {/* Previous Page */}
          <button
            className="action-btn"
            disabled={safeCurrentPage <= 1}
            onClick={() => onPageChange(safeCurrentPage - 1)}
            style={{
              padding: '4px 7px',
              fontSize: '0.75rem',
              opacity: safeCurrentPage <= 1 ? 0.4 : 1,
              cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
            }}
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Numbered Page Buttons */}
          {getPageNumbers().map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                …
              </span>
            ) : (
              <button
                key={`page-${p}`}
                className={`action-btn ${safeCurrentPage === p ? 'active' : ''}`}
                onClick={() => onPageChange(Number(p))}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: safeCurrentPage === p ? 700 : 500,
                  minWidth: '32px',
                  textAlign: 'center',
                  background: safeCurrentPage === p ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: safeCurrentPage === p ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  color: safeCurrentPage === p ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  boxShadow: safeCurrentPage === p ? '0 0 10px rgba(0, 240, 255, 0.3)' : 'none',
                }}
              >
                {p}
              </button>
            )
          )}

          {/* Next Page */}
          <button
            className="action-btn"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => onPageChange(safeCurrentPage + 1)}
            style={{
              padding: '4px 7px',
              fontSize: '0.75rem',
              opacity: safeCurrentPage >= totalPages ? 0.4 : 1,
              cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>

          {/* Last Page */}
          <button
            className="action-btn"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            style={{
              padding: '4px 7px',
              fontSize: '0.75rem',
              opacity: safeCurrentPage >= totalPages ? 0.4 : 1,
              cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}
            title={`Last Page (${totalPages})`}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
