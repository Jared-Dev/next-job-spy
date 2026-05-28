'use client';

import { Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';

import { REFRESH_EVENTS, emitRefresh } from '@/lib/storage/local/refreshEvents';

interface IPayload {
  url?: string;
  title?: string;
  company?: string;
  location?: string;
  remote?: string;
  descriptionHtml?: string;
  descriptionText?: string;
  fullPageHtml?: string;
  site?: string;
}

const ALLOWED_FIELDS = new Set([
  'url',
  'title',
  'company',
  'location',
  'remote',
  'descriptionHtml',
  'descriptionText',
  'fullPageHtml',
  'site',
]);

/**
 * Receiver page for the bookmarklet handoff. The bookmarklet (running
 * on a third-party origin like linkedin.com) opens this page in a new
 * tab and postMessages the extracted job fields across. We then build
 * a same-origin form POST to /api/import-job/from-page, which sits
 * inside our own `form-action 'self'` boundary, and let the browser
 * follow the 303 redirect into /jobs/<id>.
 *
 * Security: postMessage from anywhere is accepted (we don't know the
 * opener's origin in advance), but we only pull a fixed allowlist of
 * string fields out of the payload. The receiving API route validates
 * with zod. The user is on their own localhost; the blast radius of a
 * malicious page driving this flow is one bogus job row.
 */
export default function ClipPage() {
  const [status, setStatus] = useState<'waiting' | 'received' | 'orphan'>('waiting');

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'njs-payload') return;
      const incoming = e.data.data as Record<string, unknown>;
      if (!incoming || typeof incoming !== 'object') return;
      // Ack the sender so it stops re-posting; the opener uses a polling
      // interval since it has no other way to know when we've mounted.
      if (e.source && 'postMessage' in e.source) {
        (e.source as Window).postMessage(
          { type: 'njs-ack' },
          { targetOrigin: e.origin || '*' },
        );
      }
      setStatus('received');
      const payload: IPayload = {};
      for (const [k, v] of Object.entries(incoming)) {
        if (!ALLOWED_FIELDS.has(k)) continue;
        if (typeof v === 'string') (payload as Record<string, string>)[k] = v;
      }
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/import-job/from-page';
      form.enctype = 'application/x-www-form-urlencoded';
      form.acceptCharset = 'utf-8';
      form.style.display = 'none';
      for (const [k, v] of Object.entries(payload)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      // Notify any other open Next Job Spy tab (typically /jobs) that the
      // job list is about to change. The broadcast has to happen BEFORE
      // form.submit, since the submit navigates this tab away immediately.
      emitRefresh(REFRESH_EVENTS.Jobs);
      form.submit();
    }
    window.addEventListener('message', onMessage);

    // If nothing arrives in 8s, the user probably navigated here by hand
    // instead of via the bookmarklet; switch to the explainer state.
    const orphanTimer = setTimeout(() => {
      setStatus((s) => (s === 'waiting' ? 'orphan' : s));
    }, 8000);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(orphanTimer);
    };
  }, []);

  return (
    <Paper p="xl" withBorder maw={520} mx="auto" mt="xl">
      <Stack gap="md" align="center">
        {status === 'orphan' ? (
          <>
            <Title order={3}>Nothing to import yet</Title>
            <Text c="dimmed" ta="center">
              This page receives data from the Import to Next Job Spy
              bookmarklet. Open a job posting in another tab, click the
              bookmark, and this page will fill in.
            </Text>
          </>
        ) : (
          <>
            <Loader />
            <Title order={3}>
              {status === 'received' ? 'Importing job…' : 'Waiting for posting…'}
            </Title>
            <Text c="dimmed" ta="center">
              {status === 'received'
                ? 'Saving and kicking off Claude scoring. This tab will redirect to the new job in a moment.'
                : 'Click the Import bookmarklet in your other tab to hand off the posting.'}
            </Text>
          </>
        )}
      </Stack>
    </Paper>
  );
}
