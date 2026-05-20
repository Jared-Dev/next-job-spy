import { ETemplateId } from '@/lib/storage/types/ETemplateId';

export enum ETemplateConfidence {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export interface ITemplateSuggestion {
  id: ETemplateId;
  confidence: ETemplateConfidence;
  reason: string;
}
