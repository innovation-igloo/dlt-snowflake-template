import React from 'react';
import Tabs from '../../components/Tabs';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';
import DataTable from '../../components/DataTable';

const CONFIG_TOML = `<span class="cmt">[sources.sql_database.customers]</span>
included_columns = [<span class="str">"id"</span>, <span class="str">"email"</span>, <span class="str">"updated_at"</span>]
write_disposition = <span class="str">"merge"</span>
primary_key = <span class="str">"id"</span>`;

const QUERY_ADAPTER = `<span class="kw">def</span> only_active(query, table, incremental, engine):
    <span class="kw">return</span> query.where(table.c.status == <span class="str">"active"</span>)
customers = <b>sql_table</b>(table=<span class="str">"customers"</span>, query_adapter_callback=only_active)`;

export default function SourceShaping(): React.JSX.Element {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Controlling what and how you read</p>
        <h2>Source Shaping</h2>
        <p className="sub">
          Beyond backends and incremental, <code>sql_database</code> and <code>sql_table</code> give
          you control over how tables are reflected, which columns are read, and how the SQL and
          types are adapted before loading.
        </p>
        <Tabs
          tabs={[
            {
              label: 'Reflection',
              content: (
                <>
                  <DataTable
                    headers={['reflection_level', 'What is reflected', 'When to use']}
                    rows={[
                      [
                        <code key="minimal">minimal</code>,
                        'Names + nullability + PKs only; types inferred from data',
                        'Exotic dialects; avoids coercion errors (skips JSON/ARRAY on sqlalchemy backend)',
                      ],
                      [
                        'full (default)',
                        '+ data types; decimals get precision/scale',
                        'Standard choice',
                      ],
                      [
                        <code key="full-precision">full_with_precision</code>,
                        '+ precision/scale on text/binary/int; bigint vs int',
                        'When Snowflake column widths matter (NUMBER(p,s), VARCHAR(n))',
                      ],
                    ]}
                  />
                  <p>
                    <code>detect_precision_hints</code> is deprecated — use{' '}
                    <code>full_with_precision</code>.
                  </p>
                  <h3>defer_table_reflect</h3>
                  <p>
                    Default <code>false</code>. When <code>true</code>, SQLAlchemy reflection is
                    deferred to execution time instead of DAG-build time — required on Airflow so
                    the scheduler isn't blocked at parse time. Requires <code>table_names</code> to
                    be provided explicitly.
                  </p>
                  <Note variant="warn">
                    With deferred reflection, hints or <code>query_adapter</code> changes applied
                    after resource creation can be overridden by the late reflection.
                  </Note>
                </>
              ),
            },
            {
              label: 'Column selection',
              content: (
                <>
                  <ul className="plain">
                    <li>
                      <code>included_columns</code> — whitelist of columns to keep (
                      <code>sql_table</code>); reduces data transferred and avoids unsupported types
                    </li>
                    <li>
                      <code>excluded_columns</code> — blacklist; easiest way to strip PII or heavy
                      blob columns
                    </li>
                    <li>
                      <code>table_names</code> — restrict which tables/views are reflected (also
                      required for <code>defer_table_reflect</code>)
                    </li>
                    <li>
                      <code>include_views</code> — also reflect views (default <code>false</code>;
                      named views in <code>table_names</code> are always reflected)
                    </li>
                    <li>
                      <code>resolve_foreign_keys</code> — reflect FK constraints into dlt references
                      hints (lineage)
                    </li>
                    <li>
                      <code>schema</code> — target database schema/namespace
                    </li>
                  </ul>
                  <CodeBlock label=".dlt/config.toml (per-table)" html={CONFIG_TOML} />
                </>
              ),
            },
            {
              label: 'Adapter callbacks',
              content: (
                <>
                  <p>
                    Four Python-only callbacks (cannot be set via config files) hook different
                    stages of extraction.
                  </p>
                  <DataTable
                    headers={['Callback', 'Hooks', 'Example use']}
                    rows={[
                      [
                        <code key="query-adapter">query_adapter_callback</code>,
                        'The generated SELECT query',
                        'Push down a WHERE, MSSQL WITH (NOLOCK); 4-arg form gets incremental + engine',
                      ],
                      [
                        <code key="table-adapter">table_adapter_callback</code>,
                        'The reflected SQLAlchemy Table',
                        'Change column types, add computed columns, convert to a subquery; remove_nullability_adapter',
                      ],
                      [
                        <code key="type-adapter">type_adapter_callback</code>,
                        "Each column's SQLAlchemy type",
                        'Remap dialect types (e.g. Snowflake TIMESTAMP_NTZ -> sa.DateTime(timezone=True))',
                      ],
                      [
                        <code key="engine-adapter">engine_adapter_callback</code>,
                        'The SQLAlchemy Engine after creation',
                        'Set isolation level; Oracle NUMBER precision listener runs first',
                      ],
                    ]}
                  />
                  <CodeBlock label="push a filter down to the database" html={QUERY_ADAPTER} />
                  <Note>
                    Adapter callbacks are Python-only; everything else on this page can also be set
                    in <code>config.toml</code> under{' '}
                    <code>{'[sources.sql_database.<table>]'}</code>.
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
