import type { IProfile } from '@/lib/storage/types/IProfile';
import type { IUsageStamp } from '@/lib/storage/types/IUsageStamp';

export interface IDistillProfileResult {
  profile: IProfile;
  usage: IUsageStamp;
}
