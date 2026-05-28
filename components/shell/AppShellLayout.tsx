'use client';

import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Container,
  Group,
  NavLink,
  ScrollArea,
  Text,
  Tooltip,
  rem,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Spotlight, spotlight } from '@mantine/spotlight';
import {
  IconBriefcase,
  IconCommand,
  IconLayoutDashboard,
  IconPalette,
  IconSearch,
  IconSend,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useModKey } from '@/lib/ui/useModKey';

import { Logo } from '@/components/brand/Logo';
import { LocalScreenDriver } from '@/components/jobs/LocalScreenDriver';
import { useAutoRefresh } from '@/lib/jobs/useAutoRefresh';
import { ScreeningStatusProvider } from '@/lib/screening/scoring/ScreeningStatusContext';

import { LastRefreshChip } from './LastRefreshChip';
import type { INavItem } from './types/INavItem';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS: INavItem[] = [
  { href: '/', label: 'Dashboard', icon: IconLayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: IconBriefcase },
  { href: '/applications', label: 'Applications', icon: IconSend },
  { href: '/sources', label: 'Sources', icon: IconSearch },
  { href: '/profile', label: 'Profile', icon: IconUser },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure();
  const mod = useModKey();
  useAutoRefresh();

  // Print routes render without app chrome so the page is a clean document.
  if (pathname?.startsWith('/resume/')) {
    return <>{children}</>;
  }

  const spotlightActions = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Overview of your search',
      onClick: () => router.push('/'),
      leftSection: <IconLayoutDashboard size={18} stroke={1.5} />,
    },
    {
      id: 'profile',
      label: 'Edit profile',
      description: 'Your canonical career data',
      onClick: () => router.push('/profile'),
      leftSection: <IconUser size={18} stroke={1.5} />,
    },
    {
      id: 'jobs',
      label: 'Jobs',
      description: 'Discovered postings',
      onClick: () => router.push('/jobs'),
      leftSection: <IconBriefcase size={18} stroke={1.5} />,
    },
    {
      id: 'applications',
      label: 'Applications',
      description: 'Track what you applied to',
      onClick: () => router.push('/applications'),
      leftSection: <IconSend size={18} stroke={1.5} />,
    },
    {
      id: 'sources',
      label: 'Sources',
      description: 'Configure where jobs come from',
      onClick: () => router.push('/sources'),
      leftSection: <IconSearch size={18} stroke={1.5} />,
    },
    {
      id: 'settings',
      label: 'Open settings',
      description: 'Anthropic API key, model, preferences',
      onClick: () => router.push('/settings'),
      leftSection: <IconSettings size={18} stroke={1.5} />,
    },
    {
      id: 'preview',
      label: 'Design preview',
      description: 'Visual kitchen sink with mock data',
      onClick: () => router.push('/preview'),
      leftSection: <IconPalette size={18} stroke={1.5} />,
    },
  ];

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Link
              href="/"
              aria-label="Next Job Spy home"
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <Logo size={26} />
            </Link>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <LastRefreshChip />
            <Tooltip label="Search (⌘K)" withArrow>
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Open command menu"
                onClick={spotlight.open}
              >
                <IconCommand size={18} stroke={1.5} />
              </ActionIcon>
            </Tooltip>
            <ThemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <AppShell.Section grow component={ScrollArea}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
            const sharedProps = {
              label: item.label,
              description: item.hint,
              leftSection: <Icon size={18} stroke={1.6} />,
              active: !!active,
              styles: { root: { borderRadius: 'var(--mantine-radius-md)', marginBottom: 4 } },
            };
            if (item.disabled) {
              return <NavLink key={item.href} component="div" disabled {...sharedProps} />;
            }
            return (
              <NavLink
                key={item.href}
                component={Link}
                href={item.href}
                onClick={() => close()}
                {...sharedProps}
              />
            );
          })}
        </AppShell.Section>
        <AppShell.Section>
          <Box px="xs" py="sm">
            <Text size="xs" c="dimmed" suppressHydrationWarning>
              v0.1 · {mod.isMac ? `${mod.symbol}K` : `${mod.symbol}+K`} for actions
            </Text>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ minHeight: `calc(100vh - ${rem(56)})` }}>
        {/*
         * ScreeningStatusProvider and LocalScreenDriver live here in
         * the shell (not inside the /jobs page) so the local LLM
         * workers persist across navigation. The provider exposes the
         * set of in-flight job ids so JobsVirtualList can still shimmer
         * the right rows when the user is on /jobs; LocalScreenDriver
         * owns the workers and renders a small status card whenever
         * there is screening activity, regardless of route.
         */}
        <ScreeningStatusProvider>
          <Container size="lg" px={0} w="100%" mb="md">
            <LocalScreenDriver />
          </Container>
          {children}
        </ScreeningStatusProvider>
      </AppShell.Main>

      <Spotlight
        actions={spotlightActions}
        nothingFound="Nothing found"
        highlightQuery
        searchProps={{ leftSection: <IconSearch size={18} stroke={1.5} />, placeholder: 'Search actions…' }}
      />
    </AppShell>
  );
}
