import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}) => {
  if (totalPages <= 1) return null;

  const startItem = totalItems ? (currentPage - 1) * (itemsPerPage || 10) + 1 : 0;
  const endItem = totalItems ? Math.min(currentPage * (itemsPerPage || 10), totalItems) : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 border-t border-slate-200/80 text-xs text-slate-500 ">
      <div>
        {totalItems ? (
          <span>
            Showing <strong className="font-semibold text-slate-700 ">{startItem}</strong> to{' '}
            <strong className="font-semibold text-slate-700 ">{endItem}</strong> of{' '}
            <strong className="font-semibold text-slate-700 ">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .map((page, idx, arr) => {
            const prev = arr[idx - 1];
            const showEllipsis = prev && page - prev > 1;

            return (
              <React.Fragment key={page}>
                {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(page)}
                  className={clsx(
                    'w-8 h-8 rounded-lg text-xs font-semibold transition-all',
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-sm '
                      : 'border border-slate-200 hover:bg-slate-100 text-slate-700 ',
                  )}
                >
                  {page}
                </button>
              </React.Fragment>
            );
          })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
