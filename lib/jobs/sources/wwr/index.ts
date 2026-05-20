import { ESourceId } from '@/lib/storage/types/ESourceId';
import type { IJob } from '@/lib/storage/types/IJob';
import type { ISourceConfig } from '@/lib/storage/types/ISourceConfig';

import type { IJobSource } from '@/lib/jobs/types/IJobSource';

import { fetchWwrCategory } from './fetch';
import { normalizeWwrItem } from './normalize';

export const wwrSource: IJobSource = {
  id: ESourceId.WeWorkRemotely,
  label: 'We Work Remotely',
  description: 'RSS-backed feed from weworkremotely.com. Pick a category slug.',
  paramFields: [
    {
      key: 'category',
      label: 'Category',
      placeholder: 'remote-programming-jobs',
      required: true,
      description: 'Category slug from weworkremotely.com/categories/<slug>',
      knownOptions: [
        { value: 'remote-programming-jobs', label: 'Programming' },
        { value: 'remote-design-jobs', label: 'Design' },
        { value: 'remote-devops-sysadmin-jobs', label: 'DevOps / SysAdmin' },
        { value: 'remote-product-jobs', label: 'Product' },
        { value: 'remote-customer-support-jobs', label: 'Customer Support' },
        { value: 'remote-marketing-jobs', label: 'Marketing' },
        { value: 'remote-sales-and-marketing-jobs', label: 'Sales & Marketing' },
        { value: 'remote-management-and-finance-jobs', label: 'Management & Finance' },
        { value: 'remote-business-jobs', label: 'Business / Exec' },
        { value: 'remote-writing-jobs', label: 'Writing' },
      ],
    },
  ],
  async fetch(config: ISourceConfig): Promise<IJob[]> {
    const category = config.params.category?.trim();
    if (!category) throw new Error('WWR source requires a "category" param.');
    const items = await fetchWwrCategory(category);
    return items.map(normalizeWwrItem);
  },
};
