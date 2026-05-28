'use client';

import { Container } from '@mantine/core';

import { ApplicationsPanel } from '@/components/applications/ApplicationsPanel';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ApplicationsPage() {
  return (
    <Container size="lg" px={0}>
      <PageHeader
        title="Applications"
        description="Every job you've applied to. The resume and cover letter you sent, and where each one stands."
      />
      <ApplicationsPanel />
    </Container>
  );
}
