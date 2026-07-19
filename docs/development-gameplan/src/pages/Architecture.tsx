import Flow from '../components/Flow';
import DataTable from '../components/DataTable';

export default function Architecture() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">How the Data Moves</p>
        <h2>Architecture</h2>
        <p className="sub">
          dlt has three internal stages: <b>extract</b> (pull rows from the source), <b>normalize</b>{' '}
          (shape them into typed tables written as JSONL/Parquet files), and <b>load</b> (push those
          files to a Snowflake stage, then <code>COPY INTO</code> the target table, then <code>MERGE</code>{' '}
          if the write disposition requires it).
        </p>

        <Flow
          nodes={[
            { icon: '🔌', title: 'Source', sub: 'SQL DB or REST API', variant: 'src' },
            { icon: '📥', title: 'Extract', sub: 'Only new/changed rows via cursor' },
            { icon: '🧰', title: 'Normalize', sub: 'Typed tables → local JSONL/Parquet' },
            { icon: '⬆️', title: 'Stage', sub: 'PUT files to Snowflake stage' },
            { icon: '❄️', title: 'Load', sub: 'COPY INTO + MERGE', variant: 'dest' },
          ]}
        />

        <h3>The "staging" concept, clarified</h3>
        <p>
          Every load into Snowflake goes through a <b>stage</b>, even when the source is a live database
          or an API rather than files. This is just how the Snowflake destination bulk-loads: dlt
          materializes the extracted rows to local files, uploads them, and runs <code>COPY INTO</code>.
          You choose where the files land:
        </p>

        <DataTable
          headers={['Option', 'How it works', 'When to use']}
          rows={[
            [
              <>
                <b>Internal stage</b> <span className="pill rec">default</span>
              </>,
              <>
                dlt runs <code>PUT</code> to Snowflake's implicit per-table stage (or a named stage via{' '}
                <code>stage_name</code>), then <code>COPY INTO</code>. Zero cloud setup.
              </>,
              'Essentially all SQL/CDC and API pipelines. This is the template default.',
            ],
            [
              <>
                <b>External stage</b>
              </>,
              <>
                Files land in your own S3/GCS/Azure bucket first (via the destination's{' '}
                <code>staging_config.bucket_url</code> + a Snowflake storage integration), then{' '}
                <code>COPY</code>.
              </>,
              'Optional dlt capability for very large volumes or an existing data lake. The template ships internal staging only; add a stage yourself if a source needs it.',
            ],
          ]}
        />

        <h3>Databases &amp; roles</h3>
        <p>
          The account is split so development never touches production data. A shared{' '}
          <b>control plane</b> holds config and artifacts; two data databases hold the actual loads, each
          with its own compute and role.
        </p>

        <DataTable
          headers={['Database', 'Holds', 'Compute', 'Role']}
          rows={[
            [
              <>
                <code>DLT_DB</code> <span className="pill rec">control plane</span>
              </>,
              <>
                <code>OPS.PIPELINE_REGISTRY</code>, the <code>DEPLOY.IMAGES</code> image repo, and the{' '}
                <code>@DEPLOY.SPECS</code> spec stage. No pipeline data.
              </>,
              '—',
              <>shared (read by both)</>,
            ],
            [
              <>
                <code>DLT_PROD_DB</code>
              </>,
              <>
                Production loads into <code>RAW</code>; run metadata in <code>OPS._DLT_RUNS</code>.
              </>,
              <>
                <code>DLT_POOL</code> · <code>DLT_WH</code>
              </>,
              <>
                <code>DLT_LOADER_ROLE</code>
              </>,
            ],
            [
              <>
                <code>DLT_DEV_DB</code>
              </>,
              <>
                Ad-hoc dev loads into per-developer <code>DEV_&lt;user&gt;</code> schemas; own{' '}
                <code>OPS._DLT_RUNS</code>.
              </>,
              <>
                <code>DLT_DEV_POOL</code> · <code>DLT_DEV_WH</code>
              </>,
              <>
                <code>DLT_DEV_ROLE</code>
              </>,
            ],
          ]}
        />
        <p>
          Both environments read the same registry from <code>DLT_DB.OPS</code> and pull the same image —
          only the destination database differs. See the <b>Setup Plan</b> for the ordered runbook.
        </p>

        <h3>Where it runs</h3>
        <p>
          The template targets a Snowflake-native runtime: the pipeline is packaged as a container image,
          run in <b>Snowpark Container Services (SPCS)</b>, and scheduled by a <b>Snowflake Task</b>. When
          dlt executes inside Snowflake it authenticates with the ambient OAuth session token, so the
          in-Snowflake deployment carries <b>no stored Snowflake credentials</b>. External runners (a
          laptop, CI) use key-pair auth instead.
        </p>
        <p>
          Pipelines are declared in a <code>registry.yml</code> and run by name from one image; a shared
          SPCS <b>compute pool</b> hosts the containers and a shared <b>Gen2 multi-cluster warehouse</b>{' '}
          runs the loads, with one Task per pipeline. See <b>Scaling &amp; Multi-pipeline</b> for how that
          fans out.
        </p>
      </div>
    </section>
  );
}
