import type { IProfile } from '@/lib/storage/types/IProfile';

export interface IImportProfileButtonProps {
  /** Called with the distilled profile (sourceMarkdown already attached). */
  onImport: (profile: IProfile) => void;
}
