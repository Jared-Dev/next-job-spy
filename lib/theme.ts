import { createTheme, rem } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: 'var(--font-mono), ui-monospace, SFMono-Regular, monospace',
  headings: {
    fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: '600',
  },
  cursorType: 'pointer',
  defaultGradient: { from: 'indigo', to: 'violet', deg: 135 },
  components: {
    Card: { defaultProps: { padding: 'lg', radius: 'lg', withBorder: true } },
    Paper: { defaultProps: { radius: 'lg' } },
    Button: { defaultProps: { radius: 'md' } },
  },
  other: {
    appName: 'next-job-spy',
    headerHeight: rem(56),
    navbarWidth: rem(240),
  },
});
