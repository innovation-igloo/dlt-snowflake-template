import Tabs from '../components/Tabs';
import DataTable from '../components/DataTable';
import Note from '../components/Note';

export default function CreditCost() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Ops</p>
        <h2>Compute cost &amp; credits</h2>
        <p className="sub">
          A dlt pipeline on Snowflake consumes credits in two places: the <b>SPCS compute pool</b> that
          runs the pipeline container, and the <b>virtual warehouse</b> that executes the{' '}
          <code>COPY INTO</code> load step. Rates below are Platform Credits per hour from Snowflake&apos;s
          Service Consumption Table (effective July 14, 2026); multiply by your per-credit price to get
          dollars.
        </p>

        <Tabs
          tabs={[
            {
              label: 'SPCS compute pools',
              content: (
                <>
                  <p>
                    When dlt runs as a scheduled SPCS service, you pay per node per hour based on the
                    compute pool&apos;s <code>INSTANCE_FAMILY</code>. Billing is per-second after a{' '}
                    <b>5-minute minimum</b> on start/resume; a suspended pool consumes nothing. Cost
                    scales with the number of running nodes (<code>MIN_NODES</code>/<code>MAX_NODES</code>).
                  </p>
                  <DataTable
                    headers={['INSTANCE_FAMILY', 'Credits / hour', 'Profile']}
                    rows={[
                      [<code>CPU_X64_XS</code>, '0.06', 'Smallest — good default for light pipelines'],
                      [<code>CPU_X64_S</code>, '0.11', 'General-purpose CPU'],
                      [<code>CPU_X64_M</code>, '0.22', 'General-purpose CPU'],
                      [<code>CPU_X64_SL</code>, '0.41', 'More vCPU for parallel extract'],
                      [<code>CPU_X64_L</code>, '0.83', 'Large CPU'],
                      [<code>HIGHMEM_X64_S</code>, '0.28', 'Memory-heavy (pyarrow / big batches)'],
                      [<code>HIGHMEM_X64_M</code>, '1.11', 'Memory-heavy'],
                      [<code>HIGHMEM_X64_SL</code>, '2.93', 'Memory-heavy'],
                      [<code>HIGHMEM_X64_L</code>, '4.44', 'Memory-heavy'],
                    ]}
                  />
                  <Note variant="tip">
                    Start a dlt pipeline on <code>CPU_X64_XS</code> or <code>CPU_X64_S</code> — extraction
                    is usually I/O-bound, not compute-bound. Move to a <code>HIGHMEM</code> family only if
                    the <code>pyarrow</code>/<code>connectorx</code> backend buffers large batches in
                    memory. GPU families exist but are not needed for ingestion. Set a short{' '}
                    <code>AUTO_SUSPEND_SECS</code> so the pool stops billing between runs.
                  </Note>
                </>
              ),
            },
            {
              label: 'Loading warehouse',
              content: (
                <>
                  <p>
                    dlt loads into Snowflake by staging files and running <code>COPY INTO</code>, which
                    executes on a <b>Gen2</b> virtual warehouse. Credits/hour roughly double with each
                    size up and vary slightly by cloud provider. Billing is per-second after a{' '}
                    <b>1-minute minimum</b> on resume; an idle warehouse with <code>AUTO_SUSPEND</code>{' '}
                    costs nothing.
                  </p>
                  <DataTable
                    headers={['Size', 'AWS / GCP cr/hr', 'Azure cr/hr']}
                    rows={[
                      [<code>XS</code>, '1.35', '1.25'],
                      [<code>S</code>, '2.7', '2.5'],
                      [<code>M</code>, '5.4', '5'],
                      [<code>L</code>, '10.8', '10'],
                      [<code>XL</code>, '21.6', '20'],
                      [<code>2XL</code>, '43.2', '40'],
                      [<code>3XL</code>, '86.4', '80'],
                      [<code>4XL</code>, '172.8', '160'],
                    ]}
                  />
                  <Note variant="tip">
                    <code>COPY INTO</code> parallelizes across the files dlt stages, so a bigger warehouse
                    helps only when you load <b>many files concurrently</b> — an <code>XS</code>/
                    <code>S</code> handles most dlt loads. A single large file can&apos;t be split, so
                    upsizing won&apos;t speed it up; instead have dlt write more, smaller Parquet files
                    (<code>file_max_items</code> / smaller <code>chunk_size</code>). Match warehouse size
                    to file count, not total volume.
                  </Note>
                  <Note variant="tip">
                    For <b>concurrency</b> across many pipelines loading at once, make <code>DLT_WH</code> a
                    Gen2 <b>multi-cluster</b> warehouse (<code>MIN/MAX_CLUSTER_COUNT</code>). Credits/hour ={' '}
                    size-rate × running clusters, so an XS at 3 clusters peaks near 4.05 cr/hr (AWS) and
                    drops to 0 when idle. Clusters handle concurrency, not single-load speed — see{' '}
                    <b>Scaling &amp; Multi-pipeline</b>.
                  </Note>
                </>
              ),
            },
            {
              label: 'Credits to dollars',
              content: (
                <>
                  <p>
                    Platform Credits are billed at a per-credit dollar rate set by your Snowflake edition
                    and region. The on-demand reference rates for AWS US East / US West (Standard pricing
                    regions) are:
                  </p>
                  <DataTable
                    headers={['Edition', 'USD / credit (on demand)']}
                    rows={[
                      ['Standard', '$2.00'],
                      ['Enterprise', '$3.00'],
                      ['Business Critical', '$4.00'],
                      ['VPS', '$6.00'],
                    ]}
                  />
                  <p>
                    Worked examples at Enterprise ($3.00/credit): a Gen2 <code>S</code> warehouse on AWS
                    (2.7 cr/hr) ≈<b> $8.10/hour</b> while active; a <code>CPU_X64_S</code> compute-pool
                    node (0.11 cr/hr) ≈<b> $0.33/hour</b> per node.
                  </p>
                  <Note variant="warn">
                    Per-credit price varies by region — e.g. AWS Sydney Standard is $2.75, not $2.00 —
                    and Capacity contracts apply a discount. AI Credits are priced separately and are not
                    subject to the Platform Credit discount. Always confirm your rate against the{' '}
                    <a
                      href="https://www.snowflake.com/legal-files/CreditConsumptionTable.pdf"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Snowflake Service Consumption Table
                    </a>{' '}
                    for your cloud, region, and edition.
                  </Note>
                </>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
