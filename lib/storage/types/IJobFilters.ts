import { EJobStatus } from './EJobStatus';
import { ESourceId } from './ESourceId';

export interface IJobFilters {
  status?: EJobStatus[];
  sources?: ESourceId[];
  /** ISO country codes plus the literal "unknown" for jobs with no inferred country. */
  countries?: string[];
  search?: string;
  minFitScore?: number;
  remoteOnly?: boolean;
  /**
   * Default behavior hides jobs the cascade dropped (`screened_out` /
   * `expired`). Set true for the audit UI when sampling false-negatives.
   */
  includeScreened?: boolean;
}

export const UNKNOWN_COUNTRY_TOKEN = 'unknown';
