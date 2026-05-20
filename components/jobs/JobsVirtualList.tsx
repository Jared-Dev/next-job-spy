'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';

import type { IJob } from '@/lib/storage/types/IJob';

import { JobRow } from './JobRow';

interface IJobsVirtualListProps {
  jobs: IJob[];
}

const ROW_ESTIMATE = 110;
const ROW_GAP = 12;

export function JobsVirtualList({ jobs }: IJobsVirtualListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    if (!parentRef.current) return;
    const measure = () => {
      if (parentRef.current) {
        const rect = parentRef.current.getBoundingClientRect();
        setScrollMargin(rect.top + window.scrollY);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: jobs.length,
    estimateSize: () => ROW_ESTIMATE + ROW_GAP,
    overscan: 6,
    scrollMargin,
  });

  return (
    <div ref={parentRef} style={{ position: 'relative' }}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const job = jobs[virtualRow.index];
          if (!job) return null;
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                paddingBottom: ROW_GAP,
              }}
            >
              <JobRow job={job} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
