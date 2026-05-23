import type { IResumeDocument } from '@/lib/resume/types/IResumeDocument';

/**
 * Fixed sample resume for the `leader` template — a leadership-shaped
 * candidate, so the scope-and-outcome layout demonstrates itself. Rendered by
 * /resume/leader while content is still static.
 */
export const SAMPLE_LEADER_RESUME: IResumeDocument = {
  name: 'Morgan Ellis',
  headline: 'VP of Engineering',
  contact: {
    email: 'morgan.ellis@example.com',
    phone: '(206) 555-0188',
    location: 'Seattle, WA',
    site: 'morganellis.dev',
  },
  summary:
    'Engineering leader who builds and scales the orgs behind fast-growing ' +
    'products. Took three teams through hypergrowth, a dozen to 120-plus, ' +
    'turned around a stalled platform org, and consistently ships the ' +
    'business outcome rather than just the software. Hires exceptionally and ' +
    'makes engineering legible to the rest of the company.',
  competencies: [
    {
      category: 'Scaling',
      items: 'Org design, hypergrowth hiring, leveling and performance frameworks',
    },
    {
      category: 'Strategy',
      items: 'Technical strategy, roadmap and prioritization, build-vs-buy',
    },
    {
      category: 'Business',
      items: 'Budget and headcount ownership, exec and board communication',
    },
    {
      category: 'Operating',
      items: 'Delivery predictability, incident and reliability culture, planning cadence',
    },
  ],
  experience: [
    {
      title: 'VP of Engineering',
      company: 'Cartographe',
      context: 'Series B mapping platform',
      scope: '92 engineers across 6 teams · $14M budget · reports to the CEO',
      dates: '2021 to Present',
      bullets: [
        'Scaled engineering from 28 to 92 in three years while holding regrettable attrition under 5%, building the recruiting engine and leveling framework behind it.',
        'Turned a replatform that was nine months late into a quarterly-shipping program; on-time delivery rose from 40% to 90%.',
        'Set the technical strategy that opened two new product lines, now roughly a third of company revenue.',
        'Built the leadership bench: hired or promoted seven managers and two directors, and the org now runs without me in the room.',
      ],
    },
    {
      title: 'Director of Engineering',
      company: 'Folio',
      context: 'Series C collaborative document editor',
      scope: '40 engineers across 4 teams · reported to the VP of Engineering',
      dates: '2017 to 2021',
      bullets: [
        'Owned the core editing org through the company Series C and 4x revenue growth.',
        'Introduced the planning and operating cadence still used company-wide; missed commitments fell by half.',
        'Led the response to a reliability crisis, standing up on-call and incident practice that took uptime from 99.5% to 99.95%.',
        'Partnered with Product and Design to ship the real-time collaboration suite that unblocked enterprise sales.',
      ],
    },
    {
      title: 'Engineering Manager',
      company: 'Brightline Analytics',
      context: 'early-stage analytics startup',
      scope: '14 engineers · first engineering manager hire',
      dates: '2013 to 2017',
      bullets: [
        'Hired and led the company first product engineering team, scaling it from 3 to 14.',
        'Established the engineering practices, code review, on-call, and planning, that the org still runs on.',
        'Shipped the analytics platform that carried the company from seed to Series B.',
      ],
    },
  ],
  earlier:
    'Senior and lead engineering roles at Pixel & Co and Tidewater Systems, 2008 to 2013.',
  education: [
    {
      degree: 'B.S. Computer Science',
      institution: 'University of Washington',
      year: '2008',
    },
  ],
  speaking: [
    {
      title: 'Advisor',
      detail: 'two seed-stage developer-tools startups',
    },
    {
      title: '“Scaling Engineering Without Scaling Chaos”',
      detail: 'LeadDev London, 2023',
    },
  ],
};
