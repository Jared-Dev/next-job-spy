import type { IJobFilters } from '@/lib/storage/types/IJobFilters';

export interface IJobFiltersProps {
  value: IJobFilters;
  onChange: (next: IJobFilters) => void;
  totalCount: number;
}
