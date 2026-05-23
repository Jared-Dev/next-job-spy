import type { IResumeDocument } from '@/lib/resume/types/IResumeDocument';

/**
 * Fixed sample resume for the `generalist` template — a cross-functional
 * candidate, so the narrative-led layout demonstrates itself. Rendered by
 * /resume/generalist while content is still static.
 */
export const SAMPLE_GENERALIST_RESUME: IResumeDocument = {
  name: 'Sasha Pell',
  headline: 'Product, Operations & Strategy',
  contact: {
    email: 'sasha.pell@example.com',
    phone: '(312) 555-0164',
    location: 'Chicago, IL',
    site: 'sashapell.com',
  },
  summary:
    'A generalist who joins early and does whatever the company needs next. ' +
    'Over twelve years I have launched products, built operations from ' +
    'nothing, run go-to-market, and stepped into the gaps between teams. The ' +
    'throughline is judgment under ambiguity: figuring out what matters, ' +
    'building the smallest thing that proves it, and handing off something ' +
    'durable. I am at my best in the messy middle of a young company.',
  competencies: [
    {
      category: 'Product',
      items: 'Discovery, roadmap and prioritization, shipping with small teams',
    },
    {
      category: 'Operations',
      items: 'Building process from zero, vendor and tooling decisions, hiring',
    },
    {
      category: 'Go-to-market',
      items: 'Positioning, early sales, customer research, pricing',
    },
    {
      category: 'Working style',
      items: 'Comfortable with ambiguity, strong written communication, cross-functional glue',
    },
  ],
  experience: [
    {
      title: 'Head of Operations',
      company: 'Lumen Goods',
      context: 'Series A consumer brand',
      dates: '2020 to Present',
      bullets: [
        'Joined as the fifth employee and built the operating backbone: finance, logistics, support, and hiring, none of which existed.',
        'Owned the move from a single warehouse to a three-region fulfillment network, cutting delivery times in half without raising headcount.',
        'Ran annual planning and the company-wide operating cadence, turning a founder-led scramble into a process the team trusts.',
        'Stood in as interim product manager for two quarters, shipping the subscription program that now drives 40% of revenue.',
      ],
    },
    {
      title: 'Senior Product Manager',
      company: 'Wayfarer',
      context: 'travel-planning marketplace',
      dates: '2016 to 2020',
      bullets: [
        'Led the trip-planning product from a rough prototype to the company most-used surface.',
        'Reframed a stalled redesign around the two decisions users actually struggled with; engagement recovered within a quarter.',
        'Partnered with sales and support to turn recurring customer complaints into a prioritized, shipped roadmap.',
      ],
    },
    {
      title: 'Founding Generalist',
      company: 'Northwind Labs',
      context: 'early-stage productivity startup',
      dates: '2013 to 2016',
      bullets: [
        'Employee number two: did product, customer research, and early sales until each was big enough to hand off.',
        'Ran more than 100 customer interviews that redirected the product from a feature into a standalone tool.',
        'Built the first onboarding and billing flows, and the support function behind them.',
      ],
    },
  ],
  earlier:
    'Analyst and coordinator roles in management consulting, 2010 to 2013.',
  education: [
    {
      degree: 'B.A. Economics',
      institution: 'University of Chicago',
      year: '2010',
    },
  ],
  speaking: [
    {
      title: 'Mentor',
      detail: 'first-time operators at two startup accelerators',
    },
    { title: '“Operating in the Messy Middle”', detail: 'On Deck, 2022' },
  ],
};
