'use client';

import { Container, Paper, Stack } from '@mantine/core';

import { BookmarkletInstall } from '@/components/settings/BookmarkletInstall';
import { CoverLetterMaintenance } from '@/components/settings/CoverLetterMaintenance';
import { DataPortability } from '@/components/settings/DataPortability';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { PageHeader } from '@/components/ui/PageHeader';

export default function SettingsPage() {
  return (
    <Container size="sm" px={0}>
      <PageHeader
        title="Settings"
        description="Configure how AI calls run and manage your local data."
      />
      <Stack gap="lg">
        <Paper p="lg" withBorder>
          <SettingsForm />
        </Paper>
        <BookmarkletInstall />
        <CoverLetterMaintenance />
        <DataPortability />
      </Stack>
    </Container>
  );
}
