import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { HAIRLINE, INK, MUTED, SANS } from '@/components/resume/pdf/shared';
import { ensureSigned } from '@/lib/coverLetter/ensureSigned';
import { parseMarkdownBlocks, type TBlock, type TInlineNode } from '@/lib/coverLetter/parseMarkdown';

/**
 * Cover-letter PDF rendered through @react-pdf. Replaces the browser-print
 * path so the produced file carries no library fingerprint in its metadata
 * stream (Producer, Creator, Subject, Keywords are blanked the same way the
 * resume document does it).
 *
 * Layout matches the north-star example: pure paragraphs, near-black body,
 * roomy paragraph gap, 1in margins. No header block, no salutation, no
 * closing block. Headings and lists are styled neutral so a stray `#` or `-`
 * doesn't introduce decoration the recruiter shouldn't see.
 */

// Styling tracks the "north star" reference example: pure paragraphs, no
// header block, no salutation, no closing block, near-black body text, roomy
// paragraph spacing, no decorative accents. Headings are deliberately styled
// neutral (same size + weight as a paragraph break) so that if the model
// slips a `#` line in, it doesn't read as an indigo title bar.
const s = StyleSheet.create({
  page: {
    paddingVertical: 72,
    paddingHorizontal: 72,
    fontFamily: SANS,
    fontSize: 11,
    color: INK,
    lineHeight: 1.5,
  },
  body: { color: INK },
  h1: {
    fontSize: 11,
    fontWeight: 600,
    color: INK,
    marginBottom: 14,
  },
  h2: {
    fontSize: 11,
    fontWeight: 600,
    color: INK,
    marginTop: 14,
    marginBottom: 4,
  },
  h3: {
    fontSize: 11,
    fontWeight: 600,
    color: INK,
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 14,
  },
  list: {
    marginTop: 4,
    marginBottom: 14,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    width: 12,
    color: MUTED,
  },
  itemText: {
    flex: 1,
  },
  divider: {
    borderBottomWidth: 0.6,
    borderBottomColor: HAIRLINE,
    marginVertical: 14,
  },
  link: {
    color: INK,
    textDecoration: 'none',
  },
  strong: { fontWeight: 600, color: INK },
  em: { fontStyle: 'italic' },
});

function renderInline(nodes: TInlineNode[], keyBase: string) {
  return nodes.map((node, i) => {
    const key = `${keyBase}-${i}`;
    if (node.type === 'strong') return <Text key={key} style={s.strong}>{node.value}</Text>;
    if (node.type === 'em') return <Text key={key} style={s.em}>{node.value}</Text>;
    if (node.type === 'link') {
      return (
        <Link key={key} src={node.href} style={s.link}>
          {node.value}
        </Link>
      );
    }
    return <Text key={key}>{node.value}</Text>;
  });
}

function renderBlock(block: TBlock, index: number) {
  const key = `b-${index}`;
  if (block.type === 'heading') {
    const headingStyle = block.level === 1 ? s.h1 : block.level === 2 ? s.h2 : s.h3;
    return (
      <Text key={key} style={headingStyle}>
        {renderInline(block.inline, key)}
      </Text>
    );
  }
  if (block.type === 'paragraph') {
    return (
      <Text key={key} style={s.paragraph}>
        {renderInline(block.inline, key)}
      </Text>
    );
  }
  if (block.type === 'list') {
    return (
      <View key={key} style={s.list}>
        {block.items.map((item, i) => (
          <View key={`${key}-${i}`} style={s.listItem}>
            <Text style={s.bullet}>{'•'}</Text>
            <Text style={s.itemText}>{renderInline(item, `${key}-${i}`)}</Text>
          </View>
        ))}
      </View>
    );
  }
  return <View key={key} style={s.divider} />;
}

export function CoverLetterDocument({
  markdown,
  candidateName,
  documentTitle,
}: {
  markdown: string;
  /** Goes into the Author metadata field; matches the candidate's resume. */
  candidateName: string;
  /** Goes into the Title metadata field; usually the file stem (no ".pdf"). */
  documentTitle?: string;
}) {
  // Auto-sign at render time as a safety net: previews of saved stories (which
  // are story bodies, not full letters) and any generated letter where the
  // model forgot to sign off will land with a proper closing block.
  const signed = ensureSigned(markdown, candidateName);
  const blocks = parseMarkdownBlocks(signed);
  return (
    <Document
      title={documentTitle ?? `${candidateName} Cover Letter`}
      author={candidateName}
      // Same metadata strip as the resume: no library fingerprint in the PDF
      // info stream, nothing for an ATS to flag.
      producer=""
      creator=""
      subject=""
      keywords=""
    >
      <Page size="LETTER" style={s.page}>
        <View style={s.body}>{blocks.map(renderBlock)}</View>
      </Page>
    </Document>
  );
}
