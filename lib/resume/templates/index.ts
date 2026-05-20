import { ETemplateId } from '@/lib/storage/types/ETemplateId';

import type { ITemplate } from '@/lib/resume/types/ITemplate';

import { generalistTemplate } from './generalist';
import { icTechnicalTemplate } from './icTechnical';
import { leaderTemplate } from './leader';

export const RESUME_TEMPLATES: Record<ETemplateId, ITemplate> = {
  [ETemplateId.IcTechnical]: icTechnicalTemplate,
  [ETemplateId.Leader]: leaderTemplate,
  [ETemplateId.Generalist]: generalistTemplate,
};

export function getTemplate(id: ETemplateId): ITemplate {
  return RESUME_TEMPLATES[id];
}

export function listTemplates(): ITemplate[] {
  return Object.values(RESUME_TEMPLATES);
}
