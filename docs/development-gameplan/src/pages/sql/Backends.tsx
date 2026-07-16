import Tabs from '../../components/Tabs';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';
import DataTable from '../../components/DataTable';

const STREAM_CODE = `<span class="kw">import</span> dlt, logging
<span class="kw">from</span> dlt.sources.sql_database <span class="kw">import</span> <b>sql_table</b>
log = logging.getLogger(<span class="str">"dlt_pipeline"</span>)
log.info(<span class="str">"streaming large_events via connectorx"</span>)
events = <b>sql_table</b>(
    table=<span class="str">"large_events"</span>,
    backend=<span class="str">"connectorx"</span>,
    backend_kwargs={<span class="str">"return_type"</span>: <span class="str">"arrow_stream"</span>, <span class="str">"batch_size"</span>: 100_000},
)`;

export default function Backends() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Extraction Engine</p>
        <h2>Backends</h2>
        <p className="sub">
          The backend is the engine dlt uses to pull rows OUT of the source database on the extraction
          side (the destination is always Snowflake). It controls speed and type fidelity. Set via the{' '}
          <code>backend=</code> argument on <code>sql_database()</code> / <code>sql_table()</code>.
        </p>
        <Tabs
          tabs={[
            {
              label: 'Choosing a backend',
              content: (
                <>
                  <p>
                    Reading rows from the source is usually the slowest part; dlt lets you pick the
                    tradeoff.
                  </p>
                  <DataTable
                    headers={['Backend', 'Output', 'Tradeoff']}
                    rows={[
                      [
                        'sqlalchemy (default)',
                        <code>list[dict]</code>,
                        'Pure Python, no extra deps, most dialect-compatible, slowest for wide/large tables',
                      ],
                      [
                        <code>pyarrow</code>,
                        'pyarrow.Table',
                        'Correct, stable typed schemas that map cleanly to Snowflake; needs pyarrow/numpy',
                      ],
                      [
                        <code>pandas</code>,
                        'pandas.DataFrame',
                        'Uses pyarrow dtypes by default; can lose decimal/date precision — avoid for decimal/date columns',
                      ],
                      [
                        <>
                          <code>connectorx</code>{' '}
                          <span className="pill rec">fastest</span>
                        </>,
                        'pyarrow.Table',
                        "Rust engine, ~2x pyarrow on Postgres; ignores chunk_size unless return_type='arrow_stream'",
                      ],
                    ]}
                  />
                  <h3>Why Arrow backends for Snowflake</h3>
                  <p>
                    Arrow carries real types that map cleanly onto Snowflake column types (pair with{' '}
                    <code>reflection_level="full_with_precision"</code> for <code>NUMBER(p,s)</code>/
                    <code>VARCHAR(n)</code>), and skips per-row Python dict overhead; dlt writes
                    Parquet to the stage.
                  </p>
                  <Note variant="tip">
                    For Snowflake, prefer <code>connectorx</code> or <code>pyarrow</code>; the
                    default <code>sqlalchemy</code> backend hands over Python dicts so types are
                    inferred later and less precise.
                  </Note>
                </>
              ),
            },
            {
              label: 'Tuning & streaming',
              content: (
                <>
                  <DataTable
                    headers={['backend_kwargs key', 'Backend', 'Effect']}
                    rows={[
                      [
                        <code>tz</code>,
                        'pyarrow',
                        'Timezone for timestamp columns, e.g. {"tz":"UTC"}',
                      ],
                      [
                        <code>dtype_backend</code>,
                        'pandas',
                        "'pyarrow' (default) or 'numpy_nullable'",
                      ],
                      [
                        <code>return_type</code>,
                        'connectorx',
                        "'arrow' (default, no chunking) or 'arrow_stream' (enables batch_size)",
                      ],
                      [
                        <code>batch_size</code>,
                        'connectorx',
                        "Batch size when return_type='arrow_stream'; defaults to chunk_size",
                      ],
                      [
                        <code>protocol</code>,
                        'connectorx',
                        "'binary' (default), 'cursor', etc.",
                      ],
                      [
                        <code>conn</code>,
                        'connectorx',
                        'Override connection string (connectorx URL format differs from SQLAlchemy)',
                      ],
                    ]}
                  />
                  <h3>chunk_size</h3>
                  <p>
                    Default <code>50000</code>. sqlalchemy / pyarrow / pandas use SQLAlchemy{' '}
                    <code>yield_per</code> (internal buffer ~2x chunk_size). connectorx
                    non-streaming IGNORES chunk_size and warns if the result exceeds it; connectorx{' '}
                    <code>arrow_stream</code> uses <code>batch_size</code> (defaults to chunk_size).
                  </p>
                  <CodeBlock
                    label="stream a large table with connectorx"
                    html={STREAM_CODE}
                  />
                  <Note variant="warn">
                    connectorx has narrower type/dialect coverage than sqlalchemy, uses its own
                    connection format (strips the SQLAlchemy driver prefix), and double-wraps JSON
                    columns as quoted strings — use dlt's built-in{' '}
                    <code>unwrap_json_connector_x(field_name)</code> via <code>add_map</code> for
                    JSON columns.
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
