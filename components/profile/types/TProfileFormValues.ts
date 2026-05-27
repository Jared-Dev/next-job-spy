import type { ESkillStrength } from '@/lib/storage/types/ESkillStrength';

export type TProfileFormValues = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  personalSiteUrl: string;
  personalSiteSections: { name: string; description: string }[];
  links: { label: string; url: string }[];
  summary: string;
  workHistory: {
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    summary: string;
    highlights: string[];
  }[];
  education: {
    school: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    gpa: string;
    gpaScale: string;
    notes: string;
  }[];
  skills: { name: string; strength: ESkillStrength }[];
  achievements: string[];
  goals: string;
  lookingFor: string;
  avoiding: string;
  workingStyle: string;
  sourceMarkdown: string;
};
