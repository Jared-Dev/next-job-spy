import { z } from 'zod';

import { ESkillStrength } from './ESkillStrength';

export const SkillSchema = z.object({
  name: z.string(),
  strength: z.nativeEnum(ESkillStrength).default(ESkillStrength.Proficient),
});

export interface ISkill extends z.infer<typeof SkillSchema> {}
