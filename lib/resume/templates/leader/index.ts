import { ETemplateId } from '@/lib/storage/types/ETemplateId';

import type { ITemplate } from '@/lib/resume/types/ITemplate';

import { PRINT_CSS } from './printCss';
import { SYSTEM_PROMPT } from './systemPrompt';

export const leaderTemplate: ITemplate = {
  id: ETemplateId.Leader,
  label: 'Leader',
  description:
    'Scope-and-outcome resume for managers and senior+ ICs who lead. Foregrounds organizational impact and business outcomes.',
  bestFor: 'Engineering managers, directors, staff+ tech leads, GMs',
  systemPrompt: SYSTEM_PROMPT,
  printCss: PRINT_CSS,
};
