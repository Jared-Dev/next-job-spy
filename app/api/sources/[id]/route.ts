import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getJobSource } from '@/lib/jobs/registry';
import { ESourceId } from '@/lib/storage/types/ESourceId';
import { SourceConfigSchema } from '@/lib/storage/types/ISourceConfig';

const PostBody = z.object({
  config: SourceConfigSchema.partial({ id: true, sourceId: true, enabled: true }),
});

interface IRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: IRouteContext) {
  const { id } = await context.params;
  if (!Object.values(ESourceId).includes(id as ESourceId)) {
    return NextResponse.json({ error: `Unknown source id: ${id}` }, { status: 404 });
  }
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const source = getJobSource(id as ESourceId);
  try {
    const jobs = await source.fetch({
      id: body.config.id ?? 'preview',
      sourceId: id as ESourceId,
      enabled: body.config.enabled ?? true,
      label: body.config.label,
      params: body.config.params,
    });
    return NextResponse.json({ jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
