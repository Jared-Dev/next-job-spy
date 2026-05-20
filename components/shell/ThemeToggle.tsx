'use client';

import { ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

export function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <Tooltip label={dark ? 'Light mode' : 'Dark mode'} withArrow>
      <ActionIcon
        variant="default"
        size="lg"
        onClick={() => setColorScheme(dark ? 'light' : 'dark')}
        aria-label="Toggle color scheme"
      >
        {dark ? <IconSun size={18} stroke={1.5} /> : <IconMoon size={18} stroke={1.5} />}
      </ActionIcon>
    </Tooltip>
  );
}
