import { ETemplateId } from '@/lib/storage/types/ETemplateId';

export interface ITemplate {
  id: ETemplateId;
  label: string;
  description: string;
  bestFor: string;
  systemPrompt: string;
  printCss: string;
}
