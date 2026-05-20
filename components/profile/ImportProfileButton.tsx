'use client';

import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconExclamationCircle, IconFileImport } from '@tabler/icons-react';
import { useRef, useState } from 'react';

import type { IDistillProfileResult } from '@/lib/ai/types/IDistillProfileResult';

import type { IImportProfileButtonProps } from './types/IImportProfileButtonProps';

export function ImportProfileButton({ onImport }: IImportProfileButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    const notifId = notifications.show({
      loading: true,
      autoClose: false,
      withCloseButton: false,
      title: 'Distilling profile…',
      message: `Reading ${file.name} and structuring it via Claude.`,
    });
    try {
      const markdown = await file.text();
      const res = await fetch('/api/ai/distill-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown }),
      });
      const data = (await res.json()) as IDistillProfileResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Distill failed (${res.status})`);
      }
      onImport(data.profile);
      notifications.update({
        id: notifId,
        loading: false,
        autoClose: 5000,
        withCloseButton: true,
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Profile imported',
        message: 'Review the populated fields below, then Save profile.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      notifications.update({
        id: notifId,
        loading: false,
        autoClose: 6000,
        withCloseButton: true,
        color: 'red',
        icon: <IconExclamationCircle size={18} />,
        title: 'Import failed',
        message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        aria-label="Profile Markdown file"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void handleFile(file);
        }}
      />
      <Button
        variant="default"
        size="sm"
        loading={busy}
        leftSection={<IconFileImport size={16} stroke={1.6} />}
        onClick={() => inputRef.current?.click()}
      >
        Import from Markdown
      </Button>
    </>
  );
}
