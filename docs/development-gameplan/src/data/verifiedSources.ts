// Catalog of dlt verified sources; brought in via `dlt init <initSlug> snowflake`.

export interface VerifiedSource {
  name: string;
  category: string;
  initSlug: string;
  auth: string;
  incremental: string;
  notes: string;
}

export const verifiedSources: VerifiedSource[] = [
  // ── CRM & Sales ──────────────────────────────────────────────────────────
  {
    name: 'Salesforce',
    category: 'CRM & Sales',
    initSlug: 'salesforce',
    auth: 'User/pass + security token',
    incremental: 'Per-resource (SystemModstamp)',
    notes: 'merge/replace per object type; formula fields not back-updated',
  },
  {
    name: 'HubSpot',
    category: 'CRM & Sales',
    initSlug: 'hubspot',
    auth: 'Private app access token',
    incremental: 'Per-resource',
    notes: 'contacts, deals, companies, tickets, web analytics events',
  },
  {
    name: 'Pipedrive',
    category: 'CRM & Sales',
    initSlug: 'pipedrive',
    auth: 'API token',
    incremental: 'Per-resource',
    notes: 'see docs',
  },

  // ── Support / Ticketing ──────────────────────────────────────────────────
  {
    name: 'Zendesk',
    category: 'Support / Ticketing',
    initSlug: 'zendesk',
    auth: 'API token',
    incremental: 'Per-resource',
    notes: 'tickets, users, events, satisfaction ratings',
  },
  {
    name: 'Freshdesk',
    category: 'Support / Ticketing',
    initSlug: 'freshdesk',
    auth: 'API key',
    incremental: 'Per-resource',
    notes: 'see docs',
  },
  {
    name: 'Jira',
    category: 'Support / Ticketing',
    initSlug: 'jira',
    auth: 'API token',
    incremental: 'Per-resource',
    notes: 'issues, projects, users, boards',
  },

  // ── Marketing / Ads / Analytics ──────────────────────────────────────────
  {
    name: 'Facebook Ads',
    category: 'Marketing / Ads / Analytics',
    initSlug: 'facebook_ads',
    auth: 'OAuth2 access token',
    incremental: 'Per-resource',
    notes: 'ads, campaigns, ad sets, ad creatives',
  },
  {
    name: 'Google Ads',
    category: 'Marketing / Ads / Analytics',
    initSlug: 'google_ads',
    auth: 'OAuth2',
    incremental: 'Per-resource',
    notes: 'requires developer token',
  },
  {
    name: 'Google Analytics',
    category: 'Marketing / Ads / Analytics',
    initSlug: 'google_analytics',
    auth: 'OAuth2',
    incremental: 'Per-resource',
    notes: 'GA4 + Universal Analytics',
  },
  {
    name: 'Matomo',
    category: 'Marketing / Ads / Analytics',
    initSlug: 'matomo',
    auth: 'API token',
    incremental: 'Per-resource',
    notes: 'see docs',
  },
  {
    name: 'Mux',
    category: 'Marketing / Ads / Analytics',
    initSlug: 'mux',
    auth: 'API key + secret',
    incremental: 'Per-resource',
    notes: 'video metrics and error analytics',
  },

  // ── Commerce & Finance ───────────────────────────────────────────────────
  {
    name: 'Shopify',
    category: 'Commerce & Finance',
    initSlug: 'shopify',
    auth: 'API password (private app)',
    incremental: 'Per-resource',
    notes: 'orders, products, customers, inventory',
  },
  {
    name: 'Stripe',
    category: 'Commerce & Finance',
    initSlug: 'stripe',
    auth: 'API key (secret key)',
    incremental: 'Per-resource',
    notes: 'charges, subscriptions, customers, invoices',
  },

  // ── Productivity / Collab / HR ────────────────────────────────────────────
  {
    name: 'Airtable',
    category: 'Productivity / Collab / HR',
    initSlug: 'airtable',
    auth: 'Personal access token',
    incremental: 'see docs',
    notes: 'loads tables from a base; schema inferred at runtime',
  },
  {
    name: 'Asana',
    category: 'Productivity / Collab / HR',
    initSlug: 'asana',
    auth: 'Personal access token',
    incremental: 'see docs',
    notes: 'tasks, projects, workspaces, teams',
  },
  {
    name: 'Notion',
    category: 'Productivity / Collab / HR',
    initSlug: 'notion',
    auth: 'Integration token',
    incremental: 'Per-resource',
    notes: 'databases and pages',
  },
  {
    name: 'Google Sheets',
    category: 'Productivity / Collab / HR',
    initSlug: 'google_sheets',
    auth: 'OAuth2 / service account',
    incremental: 'see docs',
    notes: 'specific spreadsheet ranges; schema from headers',
  },
  {
    name: 'Slack',
    category: 'Productivity / Collab / HR',
    initSlug: 'slack',
    auth: 'Bot token',
    incremental: 'Per-resource',
    notes: 'channels, messages, users, threads',
  },
  {
    name: 'Personio',
    category: 'Productivity / Collab / HR',
    initSlug: 'personio',
    auth: 'Client ID + secret',
    incremental: 'Per-resource',
    notes: 'employees, absences, attendances',
  },
  {
    name: 'Workable',
    category: 'Productivity / Collab / HR',
    initSlug: 'workable',
    auth: 'API key',
    incremental: 'Per-resource',
    notes: 'jobs, candidates, stages',
  },
  {
    name: 'Strapi',
    category: 'Productivity / Collab / HR',
    initSlug: 'strapi',
    auth: 'API token',
    incremental: 'Per-resource',
    notes: 'custom content types via REST API',
  },
  {
    name: 'Inbox / IMAP',
    category: 'Productivity / Collab / HR',
    initSlug: 'inbox',
    auth: 'IMAP credentials',
    incremental: 'Per-resource',
    notes: 'email messages via IMAP; attachments optional',
  },

  // ── Data Infra / Streaming / DB ──────────────────────────────────────────
  {
    name: 'Kafka',
    category: 'Data Infra / Streaming / DB',
    initSlug: 'kafka',
    auth: 'SASL credentials (username/password)',
    incremental: 'Streaming',
    notes: 'Confluent Kafka API; per-topic offset tracking',
  },
  {
    name: 'Amazon Kinesis',
    category: 'Data Infra / Streaming / DB',
    // Note: the dlt init command uses the slug `kinesis` (dlt init kinesis snowflake),
    // not `amazon_kinesis`. The docs page URL is amazon_kinesis but the init slug differs.
    initSlug: 'kinesis',
    auth: 'AWS access key + secret',
    incremental: 'Streaming',
    notes: 'shard-level sequence tracking; JSON or raw bytes',
  },
  {
    name: 'MongoDB',
    category: 'Data Infra / Streaming / DB',
    initSlug: 'mongodb',
    auth: 'Connection string',
    incremental: 'Per-resource',
    notes: 'BSON → relational via dlt; nested docs become child tables',
  },
  {
    name: 'Postgres Replication CDC',
    category: 'Data Infra / Streaming / DB',
    initSlug: 'pg_replication',
    auth: 'Connection string + REPLICATION role',
    incremental: 'Streaming (CDC)',
    notes: 'logical decoding via pgoutput; CDC — not the sql_database dialect',
  },

  // ── Web Scraping / Misc ──────────────────────────────────────────────────
  {
    name: 'Scrapy',
    category: 'Web Scraping / Misc',
    initSlug: 'scrapy',
    auth: 'None (public web)',
    incremental: 'see docs',
    notes: 'custom Scrapy spider integration',
  },
  {
    name: 'Chess',
    category: 'Web Scraping / Misc',
    initSlug: 'chess',
    auth: 'None (public API)',
    incremental: 'Per-resource',
    notes: 'chess.com game history by player username',
  },
  {
    name: 'GitHub',
    category: 'Web Scraping / Misc',
    initSlug: 'github',
    auth: 'Personal access token',
    incremental: 'Per-resource',
    notes: 'repos, issues, PRs, stargazers, reactions',
  },
];
