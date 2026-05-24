'use client';

import { useSyncExternalStore } from 'react';
import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

// useSyncExternalStore's server snapshot runs on SSR and on the
// initial client render before commit; the client snapshot only
// runs after. That gives us a guaranteed-stable "false" through
// hydration without a setState-in-effect (which React 19 lints
// against).
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
}

export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme('light');
  // The provider returns the user's saved scheme synchronously on
  // the client (from localStorage), but the server has no way to
  // know it. Hold the icon on the SSR fallback until after mount,
  // then flip to the real value.
  const mounted = useMounted();
  const dark = mounted && computedScheme === 'dark';
  return (
    <Tooltip label={dark ? 'Light mode' : 'Dark mode'} withArrow>
      <ActionIcon
        variant="default"
        size="lg"
        onClick={() => setColorScheme(dark ? 'light' : 'dark')}
        aria-label="Toggle color scheme"
      >
        {dark ? (
          <IconSun size={18} stroke={1.5} />
        ) : (
          <IconMoon size={18} stroke={1.5} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
