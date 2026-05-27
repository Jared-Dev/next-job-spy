import type { IResumeDocument } from '@/lib/resume/types/IResumeDocument';

/**
 * Fixed sample resume in the killer-resume style, used to iterate the document
 * design before resume generation is wired up. The /resume/sample route
 * renders this. Showcases the optional fields (linkedin, role location,
 * keyResult, techStack, education gpa/notes, forFun).
 */
export const SAMPLE_RESUME: IResumeDocument = {
  name: 'Jordan Avery',
  headline: 'Principal Frontend Engineer',
  contact: {
    email: 'jordan.avery@example.com',
    phone: '(415) 555-0142',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/jordan-avery',
    site: 'jordanavery.dev',
  },
  summary:
    'Principal Frontend Engineer (15+ years) with experience in fintech and developer tools, specializing in design systems, web performance, and frontend platform.',
  competencies: [
    {
      category: 'Languages and Frameworks',
      items: 'TypeScript, JavaScript, React, Next.js, Node.js, Remix, Astro',
    },
    {
      category: 'Tooling and Delivery',
      items: 'Vite, Playwright, Storybook, Turborepo, GitHub Actions, Figma',
    },
    {
      category: 'Focus',
      items:
        'Design systems, web performance, accessibility (WCAG 2.2), technical leadership',
    },
    {
      category: 'For Fun',
      items: 'Beekeeping (Caucasian honey bees), home-lab Kubernetes, sci-fi',
    },
  ],
  experience: [
    {
      title: 'Principal Frontend Engineer',
      company: 'Cartographe',
      context:
        'Series B mapping platform. Promoted to lead the platform pillar of a 30-engineer frontend org.',
      dates: '2021 to Present',
      location: 'Remote',
      bullets: [
        'Re-architected the map editor in React, replacing a brittle legacy renderer with a streaming canvas approach.',
        'Founded the company design system (80+ accessible components), adopted as the default across all five product teams within two quarters.',
        'Set frontend technical direction: framework strategy, rendering architecture, and the paydown of three years of accumulated tech debt.',
        'Built a performance-budget program enforced in CI; pre-merge regression catches now block bad releases before they ship.',
        'Grew the frontend org from 11 to 30 engineers: built the hiring loop, wrote the promotion rubric now used company-wide, and roughly halved new-hire ramp time.',
      ],
      keyResult:
        'Cut time-to-interactive on the flagship editor from 4.1s to 1.3s, lifting trial activation by 18 points.',
      techStack:
        'TypeScript, React, Next.js, WebGL, Vite, Playwright, Turborepo, GitHub Actions',
    },
    {
      title: 'Staff Frontend Engineer',
      company: 'Folio',
      context: 'Series C collaborative document editor; presence and commenting team.',
      dates: '2018 to 2021',
      location: 'San Francisco, CA',
      bullets: [
        'Led the incremental migration from a legacy Angular app to Next.js with zero downtime, shipped over three quarters.',
        'Designed and built the real-time presence and commenting UI, the product’s most-used surface, serving 200k+ weekly active users.',
        'Drove the accessibility program to WCAG 2.1 AA, directly unblocking three enterprise contracts.',
      ],
      keyResult:
        'Brought median document-open time from 2.4s to under 800ms, restoring the product’s "feels native" reputation.',
      techStack: 'TypeScript, React, Next.js, Yjs, WebSockets, Playwright',
    },
    {
      title: 'Senior Frontend Engineer',
      company: 'Meridian Health',
      context: 'Patient-portal platform serving 2M+ members.',
      dates: '2015 to 2018',
      location: 'Boston, MA',
      bullets: [
        'Built the appointment-scheduling experience used by 2M+ members.',
        'Established the team’s first shared component library and frontend testing standards.',
        'Led accessibility and security review for all patient-facing UI in a regulated healthcare environment.',
      ],
      techStack: 'TypeScript, React, Redux, Cypress',
    },
  ],
  earlier:
    'Frontend roles at Pixel & Co (digital product agency) and Tidewater University, 2009 to 2012.',
  projects: [
    {
      title: 'type-flow',
      detail:
        'Open-source type-safe form library; widely used in production by several startups.',
    },
    {
      title: 'a11y-audit',
      detail:
        'Accessibility linter for React component libraries; merged upstream into a widely-used design system.',
    },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      institution: 'University of Washington',
      year: '2009',
      gpa: '3.74',
      gpaScale: '4.00',
      notes: 'Specializations: Distributed Systems, HCI. Member of the ACM chapter board.',
    },
  ],
  speaking: [
    {
      title: '"Performance Budgets That Survive a Roadmap"',
      detail: 'React Summit, 2024',
    },
    { title: '"Design Systems Nobody Hates"', detail: 'Frontend Conf, 2022' },
  ],
  forFun:
    'Beekeeping with a focus on Caucasian honey bees. Home-lab Kubernetes. Working through Dennis E. Taylor’s back catalogue.',
};
