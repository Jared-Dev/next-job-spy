import { ETemplateId } from '@/lib/storage/types/ETemplateId';

import type { ITemplate } from '@/lib/resume/types/ITemplate';

import { PRINT_CSS } from './printCss';
import { SYSTEM_PROMPT } from './systemPrompt';

export const icTechnicalTemplate: ITemplate = {
  id: ETemplateId.IcTechnical,
  label: 'IC technical',
  description:
    'Dense, skills-forward resume for senior individual-contributor technical roles. Quantified bullets, JD keyword surfacing, no fluff.',
  bestFor: 'Software engineering, data, ML, infrastructure ICs at any seniority',
  systemPrompt: SYSTEM_PROMPT,
  printCss: PRINT_CSS,
};
