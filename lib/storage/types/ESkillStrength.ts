/**
 * Internal canonical skill-strength scale. Source profiles may use any scale
 * (named levels, 0-9, 1-5, years, stars), the Markdown import distills
 * whatever the user wrote onto these four buckets.
 */
export enum ESkillStrength {
  Familiar = 'familiar',
  Proficient = 'proficient',
  Advanced = 'advanced',
  Expert = 'expert',
}
