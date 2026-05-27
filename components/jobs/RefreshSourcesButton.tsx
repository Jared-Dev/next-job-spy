'use client';

import { Button, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconExclamationCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { useState } from 'react';

import { refreshAllSources } from '@/lib/jobs/refreshAllSources';
import { adapter } from '@/lib/storage';

/**
 * Secondary-styled "Refresh sources" button for the /jobs page header.
 * Pulls every enabled board source in parallel and reports the totals via
 * a toast. Disabled when the user has no enabled sources configured.
 */
export function RefreshSourcesButton() {
  const settings = adapter.useSettings();
  const configs = (settings?.sourceConfigs ?? []).filter((c) => c.enabled);
  const [refreshing, setRefreshing] = useState(false);
  const empty = configs.length === 0;

  async function handleClick() {
    if (empty) return;
    setRefreshing(true);
    const id = notifications.show({
      loading: true,
      autoClose: false,
      withCloseButton: false,
      title: `Refreshing ${configs.length} source${configs.length === 1 ? '' : 's'}…`,
      message: 'Fetching in parallel.',
    });
    const { fetched, inserted, failures } = await refreshAllSources(configs);
    notifications.update({
      id,
      loading: false,
      autoClose: 4000,
      withCloseButton: true,
      color: failures > 0 ? 'yellow' : 'teal',
      icon:
        failures > 0 ? <IconExclamationCircle size={18} /> : <IconCheck size={18} />,
      title: 'Refresh complete',
      message: `${fetched} fetched · ${inserted} new${
        failures > 0 ? ` · ${failures} source(s) failed` : ''
      }`,
    });
    setRefreshing(false);
  }

  return (
    <Tooltip
      label={empty ? 'No sources configured' : 'Refresh all enabled sources'}
      withArrow
      disabled={refreshing}
    >
      <Button
        variant="default"
        leftSection={<IconRefresh size={16} stroke={1.6} />}
        onClick={handleClick}
        loading={refreshing}
        disabled={empty}
      >
        Refresh sources
      </Button>
    </Tooltip>
  );
}
