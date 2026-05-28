import type { IImportedJob } from './types/IImportedJob';

/**
 * sessionStorage key used to hand a bookmarklet-extracted posting from
 * the /clip receiver page to the /jobs page's AddJobButton. /clip writes
 * the value right before navigating; AddJobButton reads and clears it
 * on mount so a refresh of /jobs doesn't re-trigger the same import.
 */
export const PENDING_IMPORT_STORAGE_KEY = 'njs:pending-import';

export interface IPendingImport {
  url: string;
  fields: IImportedJob;
}
