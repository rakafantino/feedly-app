import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className
}: PaginationProps) {
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = (isMobile = false) => {
    const pages = [];
    
    // For mobile, only show specific pages
    if (isMobile) {
      // Always show first page
      pages.push(1);
      
      // Show current page if not first or last
      if (currentPage > 1 && currentPage < totalPages) {
        if (currentPage > 2) {
          pages.push(-1); // Ellipsis
        }
        pages.push(currentPage);
        if (currentPage < totalPages - 1) {
          pages.push(-1); // Ellipsis
        }
      }
      
      // Show last page if more than one page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
      
      return pages;
    }
    
    // Desktop view - more comprehensive
    // Always show first page
    pages.push(1);
    
    // Add current page and pages around it
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (pages[pages.length - 1] !== i - 1) {
        // Add ellipsis if there's a gap
        pages.push(-1);
      }
      pages.push(i);
    }
    
    // Add last page if not already added
    if (totalPages > 1) {
      if (pages[pages.length - 1] !== totalPages - 1) {
        // Add ellipsis if there's a gap
        pages.push(-1);
      }
      if (pages[pages.length - 1] !== totalPages) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="flex items-center space-x-1 sm:space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPreviousPage}
          disabled={currentPage === 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Halaman sebelumnya</span>
        </Button>
        
        {/* Mobile View */}
        <div className="flex items-center space-x-1 sm:hidden">
          {getPageNumbers(true).map((page, index) => (
            page === -1 ? (
              <span key={`mobile-ellipsis-${index}`} className="px-1 text-muted-foreground text-sm">...</span>
            ) : (
              <Button
                key={`mobile-page-${page}`}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                disabled={currentPage === page}
                className="h-8 w-8 p-0"
              >
                {page}
              </Button>
            )
          ))}
        </div>
        
        {/* Desktop View */}
        <div className="hidden sm:flex items-center space-x-1">
          {getPageNumbers().map((page, index) => (
            page === -1 ? (
              <span key={`ellipsis-${index}`} className="px-1.5 text-muted-foreground">...</span>
            ) : (
              <Button
                key={`page-${page}`}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                disabled={currentPage === page}
                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                {page}
              </Button>
            )
          ))}
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Halaman berikutnya</span>
        </Button>
      </div>
    </div>
  );
} 