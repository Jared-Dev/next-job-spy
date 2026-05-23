import type { IResumeDocument } from '@/lib/resume/types/IResumeDocument';

/**
 * Fixed sample resume for the `ic-technical` template, used to iterate the
 * document design before resume generation is wired up. The /resume route
 * renders this while the route param carries a template id.
 */
export const SAMPLE_RESUME: IResumeDocument = {
  name: 'Jordan Avery',
  headline: 'Principal Frontend Engineer',
  contact: {
    email: 'jordan.avery@example.com',
    phone: '(415) 555-0142',
    location: 'San Francisco, CA',
    site: 'jordanavery.dev',
  },
  summary:
    'Principal frontend engineer with fifteen years scaling design systems ' +
    'and web performance for Series B and C SaaS. Cut time-to-interactive ' +
    '70% on a flagship product, founded a component system three product ' +
    'teams now default to, and grew a frontend org from 11 to 30 engineers.',
  competencies: [
    { category: 'Languages', items: 'TypeScript, JavaScript, HTML, CSS' },
    { category: 'Frameworks', items: 'React, Next.js, Node.js, Remix, Astro' },
    {
      category: 'Tooling',
      items: 'Vite, Playwright, Storybook, Turborepo, GitHub Actions, Figma',
    },
    {
      category: 'Focus',
      items:
        'Design systems, web performance, accessibility (WCAG 2.2), ' +
        'real-time UI, technical leadership',
    },
  ],
  experience: [
    {
      title: 'Principal Frontend Engineer',
      company: 'Cartographe',
      context: 'Series B mapping platform; frontend org of ~30 across five product teams',
      dates: '2021 to Present',
      bullets: [
        'Re-architected the map editor in React, cutting time-to-interactive from 4.1s to 1.3s and lifting trial activation 18%.',
        'Founded the company design system (80+ accessible components), adopted as the default across all five product teams within two quarters.',
        'Set frontend technical direction: framework strategy, rendering architecture, and the paydown of three years of accumulated tech debt.',
        'Built a performance-budget program enforced in CI; pre-merge regression catches dropped production UI incidents 34%.',
        'Grew the frontend org from 11 to 30 engineers: built the hiring loop, wrote the promotion rubric now used company-wide, and roughly halved new-hire ramp time.',
      ],
    },
    {
      title: 'Staff Frontend Engineer',
      company: 'Folio',
      context: 'Series C collaborative document editor',
      dates: '2018 to 2021',
      bullets: [
        'Led the incremental migration from a legacy Angular app to Next.js with zero downtime, shipped over three quarters.',
        'Designed and built the real-time presence and commenting UI, the product’s most-used surface, serving 200k+ weekly active users.',
        'Drove the accessibility program to WCAG 2.1 AA, directly unblocking three enterprise contracts.',
        'Owned rendering performance; brought median document-open time from 2.4s to under 800ms.',
      ],
    },
    {
      title: 'Senior Frontend Engineer',
      company: 'Meridian Health',
      context: 'patient-portal platform serving 2M+ members',
      dates: '2015 to 2018',
      bullets: [
        'Built the appointment-scheduling experience used by 2M+ members; reduced booking-related support tickets 40%.',
        'Established the team’s first shared component library and frontend testing standards.',
        'Led accessibility and security review for all patient-facing UI in a regulated healthcare environment.',
      ],
    },
    {
      title: 'Frontend Engineer',
      company: 'Brightline Analytics',
      context: 'early-stage analytics startup; team grew from 3 to 14 engineers',
      dates: '2012 to 2015',
      bullets: [
        'Built the customer-facing dashboard from scratch in React; it stayed the core product surface for over five years.',
        'Owned the frontend build pipeline and component library as the team scaled.',
      ],
    },
  ],
  earlier:
    'Frontend roles at Pixel & Co (digital product agency) and Tidewater University, 2009 to 2012.',
  projects: [
    {
      title: 'type-flow',
      detail:
        'open-source type-safe form library; 4k+ GitHub stars, used in production by several startups.',
    },
    {
      title: 'a11y-audit',
      detail:
        'accessibility linter for React component libraries; merged upstream into a widely-used design system.',
    },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      institution: 'University of Washington',
      year: '2009',
    },
  ],
  speaking: [
    {
      title: '“Performance Budgets That Survive a Roadmap”',
      detail: 'React Summit, 2024',
    },
    { title: '“Design Systems Nobody Hates”', detail: 'Frontend Conf, 2022' },
  ],
};
