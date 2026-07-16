import Tabs from '../../components/Tabs';
import CodeBlock from '../../components/CodeBlock';
import Note from '../../components/Note';
import DataTable from '../../components/DataTable';

const DISPOSITION_CODE = `<span class="cmt"># shorthand</span>
write_disposition=<span class="str">"merge"</span>
<span class="cmt"># explicit strategy</span>
write_disposition={<span class="str">"disposition"</span>: <span class="str">"merge"</span>, <span class="str">"strategy"</span>: <span class="str">"delete-insert"</span>}
<span class="cmt"># skip staging dedup when source is already unique per key</span>
write_disposition={<span class="str">"disposition"</span>: <span class="str">"merge"</span>, <span class="str">"strategy"</span>: <span class="str">"delete-insert"</span>, <span class="str">"deduplicated"</span>: <span class="kw">True</span>}`;

const REPLACE_CONFIG_CODE = `<span class="cmt">[destination.snowflake]</span>
replace_strategy = <span class="str">"staging-optimized"</span>
enable_atomic_swap = <span class="kw">true</span>`;

export default function WriteMerge() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">Landing the data</p>
        <h2>Write &amp; Merge</h2>
        <p className="sub">
          The write disposition decides how extracted rows land in the target table — append,
          replace, or merge — and merge/replace each have strategies.
        </p>

        <Tabs
          tabs={[
            {
              label: 'Dispositions',
              content: (
                <>
                  <DataTable
                    headers={['Value', 'Behavior', 'Use for']}
                    rows={[
                      [<code>append</code>, 'INSERT new rows after existing; no dedup', 'Immutable events/logs (default)'],
                      [<code>replace</code>, 'Remove all existing rows, load new; strategy sets atomicity', 'Full refresh / snapshots'],
                      [<code>merge</code>, 'Stage + dedup/upsert/retire by keys; falls back to append if no keys', 'Mutable data, CDC, SCD'],
                      [<code>skip</code>, 'Never write to the table', 'Schema-only declarations'],
                    ]}
                  />
                  <p>
                    The dict form extends the string, e.g.{' '}
                    <code>{'{"disposition":"merge","strategy":"upsert"}'}</code>.
                  </p>
                  <CodeBlock
                    label="string vs dict form"
                    html={DISPOSITION_CODE}
                  />
                </>
              ),
            },
            {
              label: 'Merge strategies',
              content: (
                <>
                  <DataTable
                    headers={['Strategy', 'Keys needed', 'Behavior']}
                    rows={[
                      [
                        <><code>delete-insert</code> <span className="pill rec">default</span></>,
                        'primary_key (dedup) and/or merge_key (delete scope)',
                        'Stage, dedup by PK, DELETE matching keys, INSERT staging (atomic)',
                      ],
                      [
                        <code>upsert</code>,
                        'primary_key (unique, required); no merge_key',
                        'Native SQL MERGE/UPDATE; no dedup — caller ensures uniqueness',
                      ],
                      [
                        <code>insert-only</code>,
                        'primary_key (unique, required)',
                        'INSERT if PK absent, SKIP if present; idempotent re-runs',
                      ],
                      [
                        <code>scd2</code>,
                        'no PK required; merge_key optional',
                        'Full history via validity columns; retires changed/removed rows',
                      ],
                    ]}
                  />

                  <h3>scd2 specifics</h3>
                  <ul className="plain">
                    <li>
                      Adds <code>_dlt_valid_from</code>/<code>_dlt_valid_to</code> validity columns
                      (NULL valid_to = active).
                    </li>
                    <li>
                      Surrogate row hash stored in <code>_dlt_id</code> (override via{' '}
                      <code>row_version_column_name</code>).
                    </li>
                    <li>
                      Validity columns are on the ROOT table only; join nested tables via{' '}
                      <code>_dlt_root_id</code>.
                    </li>
                    <li>
                      <b>merge_key modes</b> — unset = full-extract (absent rows retired), natural
                      key = incremental (absent rows NOT retired), partition column = only retire
                      partitions present in the extract.
                    </li>
                  </ul>

                  <h3>primary_key vs merge_key</h3>
                  <p>
                    <code>primary_key</code> defines row identity, deduplicates staging, and DELETEs
                    by exact match. <code>merge_key</code> defines the DELETE scope
                    (partition/batch) and does NOT deduplicate. Both accept compound (list/tuple).
                    Setting either forces <code>nullable=False</code> on those columns.{' '}
                    <code>upsert</code> and <code>insert-only</code> do not support{' '}
                    <code>merge_key</code>.
                  </p>
                  <ul className="plain">
                    <li>
                      <code>dedup_sort: "desc"</code> — keeps the latest row per key during staging
                      dedup.
                    </li>
                    <li>
                      <code>hard_delete</code> column — propagates physical deletes (bool{' '}
                      <code>True</code> = delete; non-bool non-NULL = delete).
                    </li>
                  </ul>
                  <Note variant="warn">
                    Snowflake does <b>not</b> enforce <code>primary_key</code> or <code>unique</code>{' '}
                    constraints and does not <code>RELY</code> on them for query planning. dlt uses these
                    keys for its own merge logic (staging dedup, DELETE scope) — uniqueness is guaranteed
                    by dlt, not the database. Setting <code>create_indexes=true</code> only adds the hints
                    to the DDL; it does not make Snowflake enforce them.
                  </Note>
                </>
              ),
            },
            {
              label: 'Replace strategies',
              content: (
                <>
                  <DataTable
                    headers={['Strategy', 'Atomic', 'Downtime', 'Snowflake behavior']}
                    rows={[
                      [
                        <><code>truncate-and-insert</code> <span className="pill rec">default</span></>,
                        'No',
                        'Yes',
                        'TRUNCATE then INSERT; fastest',
                      ],
                      [
                        <code>insert-from-staging</code>,
                        'Yes',
                        'Zero',
                        'Truncate + insert in one transaction',
                      ],
                      [
                        <code>staging-optimized</code>,
                        'Yes',
                        'Zero',
                        'Drop+recreate via CREATE TABLE ... CLONE from staging',
                      ],
                    ]}
                  />

                  <h3>enable_atomic_swap (Snowflake, staging-optimized)</h3>
                  <p>
                    Instead of clone, uses <code>ALTER TABLE ... SWAP WITH</code>; swaps staging and
                    production atomically, preserves the production table's existing GRANTs, and
                    enables zero-downtime full refreshes.
                  </p>
                  <Note variant="tip">
                    Set <code>enable_atomic_swap = true</code> in{' '}
                    <code>.dlt/config.toml</code> alongside <code>staging-optimized</code> to
                    preserve GRANTs on the production table during every full refresh.
                  </Note>
                  <CodeBlock label=".dlt/config.toml" html={REPLACE_CONFIG_CODE} />
                </>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
