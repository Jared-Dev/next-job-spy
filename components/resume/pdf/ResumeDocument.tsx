import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type {
  IResumeContact,
  IResumeDocument,
  IResumeEducation,
  IResumeRole,
} from '@/lib/resume/types/IResumeDocument';

import {
  BODY,
  COMPANY,
  FAINT,
  HAIRLINE,
  INK,
  MUTED,
  NAVY,
  SANS,
  SERIF,
} from './shared';

/**
 * The single "killer resume" PDF document. One design that carries IC,
 * leadership, and generalist candidates — leadership content surfaces via the
 * optional "scope" strip on a role; other variation lives in the bullet copy.
 *
 * Layout cues that matter:
 * - Centered header: name, then a single "Email · LinkedIn · City, State" line.
 * - Each role leads with the company (bold), with the dates on the right; the
 *   italic title sits beneath, with the role location (or "Remote") on the right.
 * - Bullets follow the Challenge / Action / Result frame. Optional anchor
 *   sub-bullets render "Key Result:" and "Tech Stack:" with open-circle markers.
 * - Education renders GPA (two decimals) and a notes line for specializations,
 *   honors, and clubs. A short "For Fun" band lands at the bottom when set.
 */

const s = StyleSheet.create({
  page: {
    paddingVertical: 44,
    paddingHorizontal: 50,
    fontFamily: SANS,
    fontSize: 10,
    color: BODY,
  },

  header: { alignItems: 'center' },
  name: {
    fontSize: 22,
    fontFamily: SERIF,
    fontWeight: 600,
    color: INK,
    lineHeight: 1.2,
    textAlign: 'center',
  },
  contact: {
    fontSize: 9.5,
    color: MUTED,
    marginTop: 6,
    lineHeight: 1.45,
    textAlign: 'center',
  },
  // Links stay readable on screen and in print — same color as surrounding
  // contact text, no underline. PDF metadata makes them clickable.
  link: {
    color: MUTED,
    textDecoration: 'none',
  },
  summary: {
    fontSize: 10,
    color: BODY,
    lineHeight: 1.55,
    marginTop: 8,
    textAlign: 'center',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    marginTop: 14,
  },

  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: SANS,
    fontWeight: 600,
    color: INK,
    letterSpacing: 1.2,
    lineHeight: 1.2,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingBottom: 3,
  },

  compRow: { flexDirection: 'row', marginBottom: 3.5 },
  compCat: {
    width: 76,
    fontSize: 9.25,
    fontFamily: SANS,
    fontWeight: 600,
    color: INK,
    lineHeight: 1.45,
  },
  compList: { flex: 1, fontSize: 9.25, color: BODY, lineHeight: 1.45 },

  role: { marginTop: 13 },
  roleFirst: { marginTop: 0 },
  roleHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  roleCompanyName: {
    fontSize: 11,
    fontFamily: SANS,
    fontWeight: 600,
    color: INK,
    lineHeight: 1.2,
  },
  roleDates: { fontSize: 9, color: FAINT, lineHeight: 1.2 },
  roleSub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 1,
  },
  // No italic style: the registered "Source Sans 3" family only has the
  // 400/600 normal weights, so @react-pdf throws "Could not resolve font" when
  // an italic variant is requested. Hierarchy comes from color + weight contrast
  // with the bold company name above.
  roleTitle: {
    fontSize: 9.75,
    fontFamily: SANS,
    color: COMPANY,
    lineHeight: 1.3,
  },
  roleLocation: {
    fontSize: 9,
    color: FAINT,
    lineHeight: 1.3,
  },
  roleContext: {
    fontSize: 9.25,
    color: COMPANY,
    marginTop: 3,
    lineHeight: 1.4,
  },
  scope: {
    fontSize: 8.75,
    fontFamily: SANS,
    fontWeight: 600,
    color: NAVY,
    marginTop: 3,
    lineHeight: 1.4,
  },

  bulletRow: { flexDirection: 'row', marginTop: 4 },
  bulletDot: {
    width: 2.6,
    height: 2.6,
    borderRadius: 1.3,
    backgroundColor: NAVY,
    marginTop: 4.2,
    marginRight: 6,
  },
  bulletText: { flex: 1, fontSize: 9.5, color: BODY, lineHeight: 1.45 },

  subBulletRow: { flexDirection: 'row', marginTop: 3, marginLeft: 12 },
  subBulletDot: {
    width: 2.6,
    height: 2.6,
    borderRadius: 1.3,
    borderWidth: 0.7,
    borderColor: NAVY,
    backgroundColor: 'transparent',
    marginTop: 4.2,
    marginRight: 6,
  },
  subBulletText: { flex: 1, fontSize: 9.25, color: BODY, lineHeight: 1.45 },

  earlier: { marginTop: 12, fontSize: 9.5, color: COMPANY, lineHeight: 1.45 },
  entry: { marginTop: 5, fontSize: 9.5, color: BODY, lineHeight: 1.45 },
  edu: { fontSize: 9.5, color: BODY, lineHeight: 1.45 },
  eduNotes: { fontSize: 9.25, color: COMPANY, marginTop: 2, lineHeight: 1.4 },
  forFun: { fontSize: 9.5, color: BODY, lineHeight: 1.45 },

  strong: { fontFamily: SANS, fontWeight: 600, color: INK },
});

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

/**
 * Wrap-false bundle for a role: header rows + first bullet. Kept as its own
 * subcomponent so the Work Experience section title can render it inside the
 * same wrap-false group as the section heading (preventing the heading from
 * orphaning at the bottom of a page).
 */
function RoleHeadBundle({ role }: { role: IResumeRole }) {
  const firstBullet = role.bullets[0];
  return (
    <View wrap={false}>
      <View style={s.roleHead}>
        <Text style={s.roleCompanyName}>{role.company}</Text>
        <Text style={s.roleDates}>{role.dates}</Text>
      </View>
      <View style={s.roleSub}>
        <Text style={s.roleTitle}>{role.title}</Text>
        {role.location ? <Text style={s.roleLocation}>{role.location}</Text> : null}
      </View>
      {role.scope ? <Text style={s.scope}>{role.scope}</Text> : null}
      {role.context ? <Text style={s.roleContext}>{role.context}</Text> : null}
      {firstBullet ? (
        <View style={s.bulletRow}>
          <View style={s.bulletDot} />
          <Text style={s.bulletText}>{firstBullet}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Everything after the head bundle — each piece wraps individually so a long
 * role can split across pages without orphaning a single bullet. */
function RoleRest({ role }: { role: IResumeRole }) {
  const restBullets = role.bullets.slice(1);
  return (
    <>
      {restBullets.map((bullet, i) => (
        <View key={i} style={s.bulletRow} wrap={false}>
          <View style={s.bulletDot} />
          <Text style={s.bulletText}>{bullet}</Text>
        </View>
      ))}
      {role.keyResult ? (
        <View style={s.subBulletRow} wrap={false}>
          <View style={s.subBulletDot} />
          <Text style={s.subBulletText}>
            <Text style={s.strong}>Key Result: </Text>
            {role.keyResult}
          </Text>
        </View>
      ) : null}
      {role.techStack ? (
        <View style={s.subBulletRow} wrap={false}>
          <View style={s.subBulletDot} />
          <Text style={s.subBulletText}>
            <Text style={s.strong}>Tech Stack: </Text>
            {role.techStack}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function Role({ role, first }: { role: IResumeRole; first?: boolean }) {
  return (
    <View style={first ? [s.role, s.roleFirst] : s.role}>
      <RoleHeadBundle role={role} />
      <RoleRest role={role} />
    </View>
  );
}

function EducationEntry({ edu }: { edu: IResumeEducation }) {
  const gpaLabel = edu.gpa
    ? edu.gpaScale
      ? `GPA ${edu.gpa}/${edu.gpaScale}`
      : `GPA ${edu.gpa}`
    : null;
  const notesParts = [gpaLabel, edu.notes ?? null].filter(Boolean);
  return (
    <View>
      <Text style={s.edu}>
        <Text style={s.strong}>{edu.degree}</Text>, {edu.institution}, {edu.year}
      </Text>
      {notesParts.length > 0 ? (
        <Text style={s.eduNotes}>{notesParts.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

/** Build the comma-separated, clickable header contact line. */
function ContactLine({ contact }: { contact: IResumeContact }) {
  const items = buildContactItems(contact);
  if (items.length === 0) return null;
  return (
    <Text style={s.contact}>
      {items.map((item, i) => (
        <Text key={i}>
          {i > 0 ? '   |   ' : ''}
          {item.href ? (
            <Link src={item.href} style={s.link}>
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </Text>
      ))}
    </Text>
  );
}

interface IContactItem {
  label: string;
  href?: string;
}

/** Render-order list of header items, paired with a clickable href when one fits. */
function buildContactItems(contact: IResumeContact): IContactItem[] {
  const items: IContactItem[] = [];
  if (contact.email) {
    items.push({ label: contact.email, href: `mailto:${contact.email.trim()}` });
  }
  if (contact.linkedin) {
    items.push({ label: contact.linkedin, href: normalizeUrl(contact.linkedin) });
  }
  if (contact.phone) {
    items.push({ label: contact.phone, href: telHref(contact.phone) });
  }
  if (contact.location) {
    // Location is not a link — recruiters expect text, and Maps URLs vary.
    items.push({ label: contact.location });
  }
  if (contact.site) {
    items.push({ label: contact.site, href: normalizeUrl(contact.site) });
  }
  return items;
}

/** Turn "example.com" into "https://example.com"; leave full URLs alone. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Strip non-dial characters and emit a tel: href. Keeps a leading '+'. */
function telHref(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/\D+/g, '');
  return `tel:${plus}${digits}`;
}

export function ResumeDocument({
  data,
  documentTitle,
}: {
  data: IResumeDocument;
  /** Overrides the default PDF metadata title. Chrome and Edge use this for
   * "Save As" when the user saves from the inline PDF viewer. */
  documentTitle?: string;
}) {
  return (
    <Document
      title={documentTitle ?? `${data.name} Resume`}
      author={data.name}
    >
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{data.name}</Text>
          <ContactLine contact={data.contact} />
          {data.summary ? <Text style={s.summary}>{data.summary}</Text> : null}
          <View style={s.divider} />
        </View>

        {/* Work Experience: section title + first role's head bundle share a
            wrap-false group, so "Work Experience" cannot orphan at the bottom
            of a page. Subsequent roles wrap normally — a role itself may now
            split across pages, but only between bullets. */}
        <View style={s.section}>
          {data.experience[0] ? (
            <>
              <View style={[s.role, s.roleFirst]}>
                <View wrap={false}>
                  <SectionTitle>Work Experience</SectionTitle>
                </View>
                <RoleHeadBundle role={data.experience[0]} />
                <RoleRest role={data.experience[0]} />
              </View>
              {data.experience.slice(1).map((role) => (
                <Role key={role.company} role={role} />
              ))}
            </>
          ) : (
            <View wrap={false}>
              <SectionTitle>Work Experience</SectionTitle>
            </View>
          )}
          {data.earlier ? (
            <Text style={s.earlier}>
              <Text style={s.strong}>Earlier:</Text> {data.earlier}
            </Text>
          ) : null}
        </View>

        {data.competencies.length > 0 ? (
          <View style={s.section}>
            <View wrap={false}>
              <SectionTitle>Skills</SectionTitle>
              <View key={data.competencies[0].category} style={s.compRow}>
                <Text style={s.compCat}>{data.competencies[0].category}</Text>
                <Text style={s.compList}>{data.competencies[0].items}</Text>
              </View>
            </View>
            {data.competencies.slice(1).map((comp) => (
              <View key={comp.category} style={s.compRow} wrap={false}>
                <Text style={s.compCat}>{comp.category}</Text>
                <Text style={s.compList}>{comp.items}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.projects && data.projects.length > 0 ? (
          <View style={s.section}>
            <View wrap={false}>
              <SectionTitle>Selected Projects</SectionTitle>
              <Text style={s.entry}>
                <Text style={s.strong}>{data.projects[0].title}:</Text>{' '}
                {data.projects[0].detail}
              </Text>
            </View>
            {data.projects.slice(1).map((project) => (
              <Text key={project.title} style={s.entry} wrap={false}>
                <Text style={s.strong}>{project.title}:</Text> {project.detail}
              </Text>
            ))}
          </View>
        ) : null}

        {data.education.length > 0 ? (
          <View style={s.section}>
            <View wrap={false}>
              <SectionTitle>Education</SectionTitle>
              <EducationEntry edu={data.education[0]} />
            </View>
            {data.education.slice(1).map((edu) => (
              <View key={edu.degree} wrap={false}>
                <EducationEntry edu={edu} />
              </View>
            ))}
          </View>
        ) : null}

        {data.speaking && data.speaking.length > 0 ? (
          <View style={s.section}>
            <View wrap={false}>
              <SectionTitle>Speaking &amp; Writing</SectionTitle>
              <Text style={s.entry}>
                <Text style={s.strong}>{data.speaking[0].title}</Text>,{' '}
                {data.speaking[0].detail}
              </Text>
            </View>
            {data.speaking.slice(1).map((talk) => (
              <Text key={talk.title} style={s.entry} wrap={false}>
                <Text style={s.strong}>{talk.title}</Text>, {talk.detail}
              </Text>
            ))}
          </View>
        ) : null}

        {data.forFun ? (
          <View style={s.section} wrap={false}>
            <SectionTitle>For Fun</SectionTitle>
            <Text style={s.forFun}>{data.forFun}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
