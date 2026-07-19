export interface NavItem {
  /** Route path used by react-router and for pager ordering. */
  path: string;
  /** Label shown in the top navbar and pager. */
  label: string;
}

export interface NavGroup {
  /** Optional section header shown above the group in the rail. */
  label?: string;
  items: NavItem[];
}

// Single source of truth for the rail (grouped) AND the prev/next pager (flattened).
// Add a page to a group here and it appears in both automatically.
export const navGroups: NavGroup[] = [
  {
    items: [{ path: '/', label: 'About DLT' }],
  },
  {
    label: 'The Template',
    items: [
      { path: '/overview', label: 'Overview' },
      { path: '/architecture', label: 'Architecture' },
      { path: '/repo', label: 'Repo Structure' },
      { path: '/auth', label: 'Auth & Secrets' },
      { path: '/setup', label: 'Setup Plan' },
    ],
  },
  {
    label: 'SQL Databases',
    items: [
      { path: '/databases', label: 'Databases' },
      { path: '/backends', label: 'Backends' },
      { path: '/incremental', label: 'Incremental & CDC' },
      { path: '/merge', label: 'Write & Merge' },
      { path: '/schema', label: 'Schema & Types' },
      { path: '/source-shaping', label: 'Source Shaping' },
      { path: '/performance', label: 'Performance & Config' },
    ],
  },
  {
    label: 'Verified Sources',
    items: [
      { path: '/verified/overview', label: 'Overview' },
      { path: '/verified/catalog', label: 'Catalog' },
      { path: '/verified/onboarding', label: 'Onboarding' },
      { path: '/verified/auth', label: 'Auth & Secrets' },
      { path: '/verified/incremental', label: 'Incremental & Dispositions' },
      { path: '/verified/salesforce', label: 'Salesforce' },
      { path: '/verified/ops', label: 'Operations & Limits' },
    ],
  },
  {
    label: 'REST APIs',
    items: [
      { path: '/api/config', label: 'Config & Resources' },
      { path: '/api/auth', label: 'Auth' },
      { path: '/api/pagination', label: 'Pagination' },
      { path: '/api/incremental', label: 'Incremental' },
      { path: '/api/relationships', label: 'Dependent Resources' },
      { path: '/api/response', label: 'Response Processing' },
      { path: '/api/client', label: 'Client & Retries' },
    ],
  },
  {
    label: 'Ops',
    items: [
      { path: '/observability', label: 'Observability' },
      { path: '/deploy', label: 'Snowflake & Deploy' },
      { path: '/cost', label: 'Compute & Credits' },
      { path: '/scaling', label: 'Scaling & Multi-pipeline' },
      { path: '/enterprise', label: 'Enterprise Concerns' },
    ],
  },
  {
    items: [{ path: '/roadmap', label: 'Build Roadmap' }],
  },
];

// Flattened order for the prev/next pager.
export const nav: NavItem[] = navGroups.flatMap((g) => g.items);

/**
 * Returns the index in `nav` that a given pathname belongs to.
 * Nested routes (e.g. /observability/spcs) resolve to their parent nav entry.
 */
export function navIndexForPath(pathname: string): number {
  const exact = nav.findIndex((n) => n.path === pathname);
  if (exact !== -1) return exact;
  let best = -1;
  let bestLen = 0;
  nav.forEach((n, i) => {
    if (n.path !== '/' && pathname.startsWith(n.path) && n.path.length > bestLen) {
      best = i;
      bestLen = n.path.length;
    }
  });
  return best === -1 ? 0 : best;
}
