import { ETemplateId } from '@/lib/storage/types/ETemplateId';

import type { ITemplate } from '@/lib/resume/types/ITemplate';

import { PRINT_CSS } from './printCss';
import { SYSTEM_PROMPT } from './systemPrompt';

export const generalistTemplate: ITemplate = {
  id: ETemplateId.Generalist,
  label: 'Generalist',
  description:
    'Narrative-led resume for cross-functional and generalist roles. Foregrounds range, judgment, and the career throughline.',
  bestFor: 'PMs, ops, BD, strategy, founding-role candidates',
  systemPrompt: SYSTEM_PROMPT,
  printCss: PRINT_CSS,
};
