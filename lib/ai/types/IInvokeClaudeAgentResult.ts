import type { IUsageStamp } from '@/lib/storage/types/IUsageStamp';

export interface IInvokeClaudeAgentResult {
  text: string;
  usage: IUsageStamp;
}
