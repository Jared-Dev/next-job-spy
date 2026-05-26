import { EJobStatus } from './EJobStatus';
import { ESourceId } from './ESourceId';

export interface IJobFilters {
  status?: EJobStatus[];
  sources?: ESourceId[];
  /** ISO country codes plus the literal "unknown" for jobs with no inferred country. */
  countries?: string[];
  /** ISO 639-3 language codes plus the literal "unknown" for jobs the
   *  detector wasn't confident about. Only meaningful when the user
   *  has more than one allowed language at the ingest gate. */
  languages?: string[];
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
export const UNKNOWN_LANGUAGE_TOKEN = 'unknown';
