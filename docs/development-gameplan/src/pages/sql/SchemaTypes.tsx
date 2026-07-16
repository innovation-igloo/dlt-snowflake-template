import Tabs from '../../components/Tabs';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';
import DataTable from '../../components/DataTable';

const contractCode = `# shorthand — same mode for all three entities
@dlt.resource(schema_contract="freeze")
# explicit per-entity
@dlt.resource(schema_contract={"tables": "evolve", "columns": "freeze", "data_type": "freeze"})
# highest precedence: at run time
pipeline.run(source, schema_contract=<span class="str">"freeze"</span>)`;

const columnHintsCode = `@dlt.resource(
    primary_key=<span class="str">"id"</span>,
    write_disposition=<span class="str">"merge"</span>,
    columns={
        <span class="str">"updated_at"</span>: {<span class="str">"data_type"</span>: <span class="str">"timestamp"</span>, <span class="str">"dedup_sort"</span>: <span class="str">"desc"</span>},
        <span class="str">"is_deleted"</span>: {<span class="str">"hard_delete"</span>: True},
        <span class="str">"amount"</span>:     {<span class="str">"data_type"</span>: <span class="str">"decimal"</span>, <span class="str">"precision"</span>: 18, <span class="str">"scale"</span>: 4},
        <span class="str">"payload"</span>:    {<span class="str">"data_type"</span>: <span class="str">"json"</span>},   <span class="cmt"># -&gt; VARIANT on Snowflake</span>
    },
)`;

export default function SchemaTypes() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">How dlt shapes your tables</p>
        <h2>Schema &amp; Types</h2>
        <p className="sub">
          dlt infers and evolves the target schema from your data. You can constrain it with
          contracts, shape it with column hints, and control how types land in Snowflake.
        </p>

        <Tabs
          tabs={[
            {
              label: 'Evolution',
              content: (
                <>
                  <DataTable
                    headers={['Source change', 'Default (evolve) behavior']}
                    rows={[
                      ['New top-level field', 'New column added to root table, type inferred'],
                      [
                        'Nested dict field',
                        <>Flattened into a column with <code>__</code> separator (address.city &rarr; address__city)</>,
                      ],
                      [
                        'Nested list field',
                        <>New child table <code>&lt;root&gt;__&lt;field&gt;</code></>,
                      ],
                      [
                        'Type incompatible with existing column',
                        <>Variant column created: <code>&lt;col&gt;__v_&lt;type&gt;</code></>,
                      ],
                      ['Type coercible (int &rarr; str)', 'Value coerced, no new column'],
                      ['Field removed', 'Column not populated; NULL in existing rows'],
                    ]}
                  />
                  <p>
                    Type autodetectors run in order; <code>iso_timestamp</code> (ISO 8601 &rarr;{' '}
                    timestamp) is on by default, plus <code>timestamp</code> (unix float),{' '}
                    <code>iso_date</code>, <code>large_integer</code> (&rarr; wei). Two
                    normalizers: <b>relational</b> (default, coerces before creating variants) and{' '}
                    <b>relational_no_coercion</b> (variant on any mismatch).
                  </p>
                </>
              ),
            },
            {
              label: 'Contracts',
              content: (
                <>
                  <p>
                    <code>schema_contract</code> enforces three entities —{' '}
                    <code>tables</code> (new table), <code>columns</code> (new column),{' '}
                    <code>data_type</code> (type change / variant) — each with a mode.
                  </p>
                  <DataTable
                    headers={['Mode', 'Behavior']}
                    rows={[
                      [<code>evolve</code>, 'All changes accepted (default)'],
                      [<code>freeze</code>, 'Raises DataValidationError / PipelineStepFailed; nothing loaded'],
                      [<code>discard_row</code>, 'The violating row is dropped silently'],
                      [<code>discard_value</code>, 'Only the offending field is removed; rest of row loads'],
                    ]}
                  />
                  <CodeBlock label="setting the contract" html={contractCode} />
                  <p>
                    Precedence is <code>run()</code> &gt; resource &gt; source. New-table
                    exception: a table with no typed columns yet is treated as{' '}
                    <code>evolve</code> on its first load, then the contract applies.
                  </p>
                  <Note variant="warn">
                    In production, freeze <code>columns</code> and <code>data_type</code> to
                    prevent silent schema drift from an upstream change.
                  </Note>
                </>
              ),
            },
            {
              label: 'Column hints',
              content: (
                <>
                  <DataTable
                    headers={['Hint', 'Meaning']}
                    rows={[
                      [<code>data_type</code>, 'Explicit type; bypasses inference'],
                      [<code>nullable</code>, 'Default true; primary_key/merge_key force false'],
                      [<><code>precision</code> / <code>scale</code></>, 'Digits / decimal places for text/timestamp/decimal/binary'],
                      [<code>timezone</code>, 'true (default) \u2192 TIMESTAMP_TZ; false \u2192 TIMESTAMP_NTZ'],
                      [<><code>primary_key</code> / <code>merge_key</code> / <code>unique</code></>, 'Keys; unique not enforced on Snowflake unless create_indexes=true'],
                      [<code>cluster</code>, 'Adds column to Snowflake CLUSTER KEY (multiple compose an ordered key)'],
                      [<><code>partition</code> / <code>sort</code></>, 'No Snowflake DDL effect (other destinations)'],
                      [<code>dedup_sort</code>, "'asc'/'desc' \u2014 which duplicate wins during merge staging dedup"],
                      [<code>hard_delete</code>, 'Marks a column that signals physical deletes'],
                    ]}
                  />
                  <CodeBlock label="columns={} hints" html={columnHintsCode} />
                  <p>
                    A direct <code>primary_key=</code> / <code>merge_key=</code> argument
                    overrides the same hint inside <code>columns={'{}'}</code>.
                  </p>
                </>
              ),
            },
            {
              label: 'Naming & nesting',
              content: (
                <>
                  <DataTable
                    headers={['Convention', 'Case', 'Snowflake identifiers']}
                    rows={[
                      ['snake_case (default)', 'Case-insensitive', 'UPPERCASE unquoted'],
                      ['sql_ci_v1', 'Case-insensitive', 'UPPERCASE unquoted'],
                      ['sql_cs_v1', 'Case-sensitive', 'Quoted (must quote in queries)'],
                      ['duck_case / direct', 'Case-sensitive', 'Quoted'],
                    ]}
                  />
                  <p>
                    Snowflake casefold is <code>str.upper</code> &mdash; case-insensitive
                    identifiers are stored/sent UPPERCASE. Nested path <code>a.b.c</code> becomes{' '}
                    <code>a__b__c</code>; identifiers over 255 chars are shortened.
                  </p>
                  <h3>Nested / child tables</h3>
                  <DataTable
                    headers={['Column', 'Table', 'Purpose']}
                    rows={[
                      [<code>_dlt_id</code>, 'all', 'Unique row id (content hash for merge/scd2)'],
                      [<code>_dlt_load_id</code>, 'all', 'References _dlt_loads.load_id'],
                      [<code>_dlt_parent_id</code>, 'child', 'FK to parent row _dlt_id'],
                      [<code>_dlt_list_idx</code>, 'child', 'Position in the source list'],
                      [<code>_dlt_root_id</code>, 'child', 'FK to root _dlt_id; added only under merge (root_key); required for nested-table merge'],
                    ]}
                  />
                </>
              ),
            },
            {
              label: 'Type mapping',
              content: (
                <>
                  <DataTable
                    headers={['dlt type', 'Snowflake type', 'Notes']}
                    rows={[
                      [<code>text</code>, <code>VARCHAR</code>, 'up to 16 MB'],
                      [<code>double</code>, <code>FLOAT</code>, ''],
                      [<code>bool</code>, <code>BOOLEAN</code>, ''],
                      [<code>timestamp</code>, <code>TIMESTAMP_TZ</code>, 'timezone=false \u2192 TIMESTAMP_NTZ; precision 0-9, default 6'],
                      [<code>date</code>, <code>DATE</code>, ''],
                      [<code>time</code>, <code>TIME</code>, ''],
                      [<code>bigint</code>, <code>NUMBER(19,0)</code>, 'Snowflake has no native integer'],
                      [<code>binary</code>, <code>BINARY</code>, ''],
                      [<code>json</code>, <code>VARIANT</code>, 'From Parquet it lands as a string \u2014 use JSONL or PARSE_JSON'],
                      [<code>decimal</code>, <code>NUMBER(p,s)</code>, 'default precision/scale if unbound'],
                      [<><code>decimal</code> (unbound, use_decfloat=true)</>, <code>DECFLOAT</code>, '36 significant digits; jsonl/csv only, no Arrow'],
                      [<code>wei</code>, <code>NUMBER(38,0)</code>, '256-bit integers'],
                    ]}
                  />
                  <Note variant="tip">
                    For JSON-heavy schemas stage as JSONL (not Parquet) so <code>json</code> lands
                    as <code>VARIANT</code> rather than a string.
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
