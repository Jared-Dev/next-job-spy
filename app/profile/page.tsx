'use client';

import { Container, Stack } from '@mantine/core';

import { ProfileForm } from '@/components/profile/ProfileForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { adapter } from '@/lib/storage';

export default function ProfilePage() {
  const profile = adapter.useProfile();
  const hasContent =
    profile !== undefined &&
    (Boolean(profile.fullName) ||
      (profile.workHistory?.length ?? 0) > 0 ||
      (profile.skills?.length ?? 0) > 0);

  return (
    <Container size="md" px={0}>
      <PageHeader
        title={hasContent ? 'Your profile' : 'Build your profile'}
        description={
          hasContent
            ? 'The canonical source. Per-job resumes get generated from this.'
            : 'Fill this in once. Per-job ATS-optimized resumes get generated from it.'
        }
      />
      <Stack gap="xl">
        <ProfileForm initial={profile} />
      </Stack>
    </Container>
  );
}
