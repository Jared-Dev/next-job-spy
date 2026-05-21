import { EApplicationStatus } from '@/lib/storage/types/EApplicationStatus';

const META: Record<EApplicationStatus, { label: string; color: string }> = {
  [EApplicationStatus.Drafting]: { label: 'Drafting', color: 'gray' },
  [EApplicationStatus.Ready]: { label: 'Ready to send', color: 'yellow' },
  [EApplicationStatus.Submitted]: { label: 'Submitted', color: 'indigo' },
  [EApplicationStatus.Interview]: { label: 'Interviewing', color: 'violet' },
  [EApplicationStatus.Offer]: { label: 'Offer', color: 'teal' },
  [EApplicationStatus.Rejected]: { label: 'Rejected', color: 'red' },
  [EApplicationStatus.Closed]: { label: 'Closed', color: 'gray' },
};

/** Display label + Mantine color for an application status. */
export function applicationStatusMeta(status: EApplicationStatus): {
  label: string;
  color: string;
} {
  return META[status];
}
