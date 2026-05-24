import type { IJob } from '@/lib/storage/types/IJob';

/**
 * BGE-small's effective input is ~512 tokens (roughly 2 to 3k characters). We
 * leave a margin and truncate the description here so the title +
 * company + location still anchor the embedding even when the
 * description is long.
 */
const MAX_DESC_CHARS = 4000;

export function jobTextForEmbedding(
  job: Pick<IJob, 'title' | 'company' | 'location' | 'descriptionMd'>,
): string {
  const parts: string[] = [`${job.title} at ${job.company}`];
  if (job.location) parts.push(job.location);
  if (job.descriptionMd) {
    const desc =
      job.descriptionMd.length > MAX_DESC_CHARS
        ? job.descriptionMd.slice(0, MAX_DESC_CHARS)
        : job.descriptionMd;
    parts.push(desc);
  }
  return parts.join('\n\n');
}
