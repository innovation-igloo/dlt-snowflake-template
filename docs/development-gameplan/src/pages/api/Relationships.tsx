import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

export default function ApiRelationships() {
  const placeholderHtml = `{
    <span class="str">"name"</span>: <span class="str">"comments"</span>,
    <span class="str">"endpoint"</span>: {
        <span class="str">"path"</span>: <span class="str">"issues/{resources.issues.number}/comments"</span>,
        <span class="str">"params"</span>: {<span class="str">"per_page"</span>: <span class="kw">100</span>},
    },
    <span class="str">"include_from_parent"</span>: [<span class="str">"id"</span>, <span class="str">"title"</span>],
}`;

  const legacyHtml = `<span class="str">"params"</span>: {
    <span class="str">"issue_number"</span>: {<span class="str">"type"</span>: <span class="str">"resolve"</span>, <span class="str">"resource"</span>: <span class="str">"issues"</span>, <span class="str">"field"</span>: <span class="str">"number"</span>}
}`;

  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">API Sources</p>
        <h2>Dependent resources</h2>
        <p className="sub">
          A dependent (child) resource makes one request per record of its parent — e.g. fetch
          comments for each issue. dlt resolves the dependency graph and loads parents first.
        </p>

        <h3>Modern placeholder syntax (recommended)</h3>
        <p>
          Reference a parent field with{' '}
          <span className="pill">{'{resources.<parent_name>.<field>}'}</span> anywhere in{' '}
          <code>path</code>, <code>params</code>, <code>json</code>, <code>data</code>, or{' '}
          <code>headers</code>. dlt resolves it against each parent record.
        </p>
        <CodeBlock label="child resource via placeholder" html={placeholderHtml} />

        <h3>Legacy resolve syntax</h3>
        <p>The older typed form still works — put a resolve dict in params:</p>
        <CodeBlock label="resolve dict (legacy)" html={legacyHtml} />

        <h3>include_from_parent</h3>
        <p>
          Lists parent fields to copy onto each child record. They land prefixed as{' '}
          <code>_&lt;parent_name&gt;_&lt;field&gt;</code> — so{' '}
          <code>include_from_parent ["id","title"]</code> on a parent named{' '}
          <code>"issues"</code> adds <code>_issues_id</code> and <code>_issues_title</code> to
          every child row.
        </p>

        <h3>parallelized</h3>
        <p>
          Set <code>parallelized: True</code> on a dependent resource to fetch children
          concurrently in dlt{"'"}s thread pool (all pages for one parent item are collected before
          yielding).
        </p>

        <DataTable
          headers={['Constraint', 'Behavior']}
          rows={[
            ['Parents per child', 'Exactly one (multiple raises ValueError)'],
            ['Load order', 'dlt topologically sorts resources; parents run before children'],
            ['Parent type', 'The parent may be any DltResource, not only another rest_api resource'],
          ]}
        />

        <Note variant="tip">
          The parent resource must be declared in the same <code>rest_api_source</code> config. Use{' '}
          <code>include_from_parent</code> when the child response lacks the parent key you need to
          join on in Snowflake.
        </Note>
      </div>
    </section>
  );
}
