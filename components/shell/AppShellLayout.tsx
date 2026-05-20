'use client';

import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
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
  IconSettings,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAutoRefresh } from '@/lib/jobs/useAutoRefresh';

import { LastRefreshChip } from './LastRefreshChip';
import type { INavItem } from './types/INavItem';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS: INavItem[] = [
  { href: '/', label: 'Dashboard', icon: IconLayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: IconBriefcase },
  { href: '/sources', label: 'Sources', icon: IconSearch },
  { href: '/profile', label: 'Profile', icon: IconUser },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure();
  useAutoRefresh();

  // Print routes render without app chrome so the page is a clean document.
  if (pathname?.startsWith('/r/')) {
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
            <Group gap={8} wrap="nowrap">
              <IconSparkles size={20} stroke={1.6} color="var(--mantine-color-indigo-5)" />
              <Text fw={600} size="sm" component={Link} href="/">
                next-job-spy
              </Text>
            </Group>
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
            <Text size="xs" c="dimmed">
              v0.1 · {String.fromCharCode(8984)}K for actions
            </Text>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main style={{ minHeight: `calc(100vh - ${rem(56)})` }}>
        {children}
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
