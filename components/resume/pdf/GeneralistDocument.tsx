import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type {
  IResumeDocument,
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
 * The `generalist` resume — for cross-functional and generalist roles (PM,
 * ops, BD, strategy, founding-team). Narrative-led: the summary is the hero,
 * set larger to carry the career throughline; the capability band clusters by
 * theme rather than tech stack; bullets frame judgment and range over raw
 * metrics. More air than `ic-technical`.
 */

const s = StyleSheet.create({
  page: {
    paddingVertical: 46,
    paddingHorizontal: 54,
    fontFamily: SANS,
    fontSize: 10,
    color: BODY,
  },

  name: {
    fontSize: 22,
    fontFamily: SERIF,
    fontWeight: 600,
    color: INK,
    lineHeight: 1.2,
  },
  headline: { fontSize: 10.5, color: COMPANY, marginTop: 4, lineHeight: 1.35 },
  contact: { fontSize: 9, color: MUTED, marginTop: 8, lineHeight: 1.45 },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    marginTop: 13,
  },

  section: { marginTop: 19 },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: SERIF,
    fontWeight: 600,
    color: NAVY,
    letterSpacing: 1.2,
    lineHeight: 1.2,
    marginBottom: 8,
  },
  // The hero — set larger than other templates' summaries.
  summary: { fontSize: 11, color: BODY, lineHeight: 1.62 },

  compRow: { flexDirection: 'row', marginBottom: 4 },
  compCat: {
    width: 80,
    fontSize: 9.25,
    fontFamily: SANS,
    fontWeight: 600,
    color: MUTED,
    lineHeight: 1.45,
  },
  compList: { flex: 1, fontSize: 9.25, color: BODY, lineHeight: 1.45 },

  role: { marginTop: 14 },
  roleFirst: { marginTop: 0 },
  roleHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  roleTitle: {
    fontSize: 10.5,
    fontFamily: SANS,
    fontWeight: 600,
    color: INK,
    lineHeight: 1.25,
  },
  roleDates: { fontSize: 9, color: FAINT, lineHeight: 1.25 },
  roleCompany: { fontSize: 9.5, color: COMPANY, marginTop: 2, lineHeight: 1.35 },

  bulletRow: { flexDirection: 'row', marginTop: 4.5 },
  bulletDot: {
    width: 2.6,
    height: 2.6,
    borderRadius: 1.3,
    backgroundColor: NAVY,
    marginTop: 4.4,
    marginRight: 6,
  },
  bulletText: { flex: 1, fontSize: 9.5, color: BODY, lineHeight: 1.5 },

  earlier: { marginTop: 13, fontSize: 9.5, color: COMPANY, lineHeight: 1.45 },
  entry: { marginTop: 5, fontSize: 9.5, color: BODY, lineHeight: 1.45 },
  edu: { fontSize: 9.5, color: BODY, lineHeight: 1.45 },

  strong: { fontFamily: SANS, fontWeight: 600, color: INK },
});

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function Role({ role, first }: { role: IResumeRole; first?: boolean }) {
  return (
    <View style={first ? [s.role, s.roleFirst] : s.role} wrap={false}>
      <View style={s.roleHead}>
        <Text style={s.roleTitle}>{role.title}</Text>
        <Text style={s.roleDates}>{role.dates}</Text>
      </View>
      <Text style={s.roleCompany}>
        <Text style={s.strong}>{role.company}</Text>, {role.context}
      </Text>
      {role.bullets.map((bullet, i) => (
        <View key={i} style={s.bulletRow}>
          <View style={s.bulletDot} />
          <Text style={s.bulletText}>{bullet}</Text>
        </View>
      ))}
    </View>
  );
}

export function GeneralistDocument({ data }: { data: IResumeDocument }) {
  const contactLine = [
    data.contact.email,
    data.contact.phone,
    data.contact.location,
    data.contact.site,
  ]
    .filter(Boolean)
    .join('   ·   ');

  return (
    <Document title={`${data.name} Resume`} author={data.name}>
      <Page size="LETTER" style={s.page}>
        <View>
          <Text style={s.name}>{data.name}</Text>
          <Text style={s.headline}>{data.headline}</Text>
          <Text style={s.contact}>{contactLine}</Text>
          <View style={s.divider} />
        </View>

        <View style={s.section} wrap={false}>
          <SectionTitle>Summary</SectionTitle>
          <Text style={s.summary}>{data.summary}</Text>
        </View>

        <View style={s.section} wrap={false}>
          <SectionTitle>Strengths</SectionTitle>
          {data.competencies.map((comp) => (
            <View key={comp.category} style={s.compRow}>
              <Text style={s.compCat}>{comp.category}</Text>
              <Text style={s.compList}>{comp.items}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <SectionTitle>Experience</SectionTitle>
          {data.experience.map((role, i) => (
            <Role key={role.company} role={role} first={i === 0} />
          ))}
          {data.earlier ? (
            <Text style={s.earlier}>
              <Text style={s.strong}>Earlier:</Text> {data.earlier}
            </Text>
          ) : null}
        </View>

        {data.education.length > 0 ? (
          <View style={s.section} wrap={false}>
            <SectionTitle>Education</SectionTitle>
            {data.education.map((edu) => (
              <Text key={edu.degree} style={s.edu}>
                <Text style={s.strong}>{edu.degree}</Text>, {edu.institution},{' '}
                {edu.year}
              </Text>
            ))}
          </View>
        ) : null}

        {data.speaking && data.speaking.length > 0 ? (
          <View style={s.section} wrap={false}>
            <SectionTitle>Speaking &amp; Writing</SectionTitle>
            {data.speaking.map((talk) => (
              <Text key={talk.title} style={s.entry}>
                <Text style={s.strong}>{talk.title}</Text>, {talk.detail}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
