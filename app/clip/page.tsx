'use client';

import { Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';

import {
  PENDING_IMPORT_STORAGE_KEY,
  type IPendingImport,
} from '@/lib/jobs/importJob/pendingImport';

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

const ALLOWED_FIELDS = new Set<keyof IPayload>([
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
 * tab and postMessages the extracted job fields across. We POST the
 * payload to /api/import-job/from-page, which layers JSON-LD + Mozilla
 * Readability + structured parsing over what the bookmarklet caught,
 * and returns merged fields. We stash those in sessionStorage and
 * navigate to /jobs, where AddJobButton opens its modal pre-populated.
 * The user reviews and saves through the existing manual-add flow,
 * which makes any location/company miss easy to fix before the job
 * lands in the DB.
 */
export default function ClipPage() {
  const [status, setStatus] = useState<
    'waiting' | 'extracting' | 'orphan' | 'error'
  >('waiting');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let handled = false;

    async function processPayload(incoming: Record<string, unknown>) {
      const formData = new FormData();
      for (const [k, v] of Object.entries(incoming)) {
        if (!ALLOWED_FIELDS.has(k as keyof IPayload)) continue;
        if (typeof v === 'string') formData.append(k, v);
      }
      const res = await fetch('/api/import-job/from-page', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const data = (await res.json()) as IPendingImport;
      sessionStorage.setItem(PENDING_IMPORT_STORAGE_KEY, JSON.stringify(data));
      window.location.href = '/jobs';
    }

    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'njs-payload') return;
      const incoming = e.data.data as Record<string, unknown>;
      if (!incoming || typeof incoming !== 'object') return;
      if (handled) return;
      handled = true;
      // Ack the sender so it stops re-posting; the opener uses a polling
      // interval since it has no other way to know when we've mounted.
      if (e.source && 'postMessage' in e.source) {
        (e.source as Window).postMessage(
          { type: 'njs-ack' },
          { targetOrigin: e.origin || '*' },
        );
      }
      setStatus('extracting');
      processPayload(incoming).catch((err: unknown) => {
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Unknown extraction error',
        );
      });
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
        ) : status === 'error' ? (
          <>
            <Title order={3}>Could not read that page</Title>
            <Text c="red" ta="center">
              {errorMessage}
            </Text>
            <Text c="dimmed" ta="center" size="sm">
              Open the Jobs page and click Add job to fill the form in by hand.
            </Text>
          </>
        ) : (
          <>
            <Loader />
            <Title order={3}>
              {status === 'extracting'
                ? 'Reading the posting…'
                : 'Waiting for posting…'}
            </Title>
            <Text c="dimmed" ta="center">
              {status === 'extracting'
                ? 'Pulling title, company, location and description. You can review and edit before saving.'
                : 'Click the Import bookmarklet in your other tab to hand off the posting.'}
            </Text>
          </>
        )}
      </Stack>
    </Paper>
  );
}
