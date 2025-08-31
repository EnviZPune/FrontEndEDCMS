import React from 'react';
import '../Styling/pagination.css'

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  maxButtons?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  totalCount,
  onPageChange,
  maxButtons = 5,
}) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages < 2) return null;

  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(totalPages, page + half);

  if (page <= half) {
    start = 1;
    end = Math.min(totalPages, maxButtons);
  } else if (page + half > totalPages) {
    end = totalPages;
    start = Math.max(1, totalPages - maxButtons + 1);
  }

  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <nav aria-label="Pagination" className="flex space-x-2 my-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="px-3 py-1 border rounded"
      >
        Prev
      </button>

      {start > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-1 border rounded"
          >
            1
          </button>
          {start > 2 && <span className="px-2">…</span>}
        </>
      )}

      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={`px-3 py-1 border rounded ${
            p === page ? 'bg-gray-200' : ''
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-2">…</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-1 border rounded"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="px-3 py-1 border rounded"
      >
        Next
      </button>
    </nav>
  );
};

export default Pagination;
