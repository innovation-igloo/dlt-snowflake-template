import CodeBlock from '../../components/CodeBlock';
import DataTable from '../../components/DataTable';
import Note from '../../components/Note';

const OFFSET_PAGINATOR = `<span class="str">"endpoint"</span>: {
    <span class="str">"path"</span>: <span class="str">"records"</span>,
    <span class="str">"paginator"</span>: {<span class="str">"type"</span>: <span class="str">"offset"</span>, <span class="str">"limit"</span>: <span class="kw">1000</span>, <span class="str">"total_path"</span>: <span class="str">"meta.total"</span>},
}`;

export default function ApiPagination() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">API Sources</p>
        <h2>Pagination</h2>
        <p className="sub">
          Set a paginator at the client level (default for all resources) or per endpoint (highest
          precedence). Pass a string alias for the common cases or a dict with params.
        </p>

        <h3>Built-in paginators</h3>
        <DataTable
          headers={['Alias', 'Class', 'Key params']}
          rows={[
            [
              <span className="pill">auto</span>,
              <em>(auto-detect)</em>,
              'none — dlt inspects the first response and picks one',
            ],
            [<span className="pill">single_page</span>, 'SinglePagePaginator', 'none'],
            [
              <span className="pill">header_link</span>,
              'HeaderLinkPaginator',
              'links_next_key ("next")',
            ],
            [
              <span className="pill">json_link</span>,
              'JSONLinkPaginator',
              'next_url_path ("next")',
            ],
            [
              <span className="pill">cursor</span>,
              'JSONResponseCursorPaginator',
              'cursor_path ("cursors.next"), cursor_param ("cursor"), cursor_body_path, has_more_path',
            ],
            [
              <span className="pill">header_cursor</span>,
              'HeaderCursorPaginator',
              'cursor_key ("next"), cursor_param ("cursor")',
            ],
            [
              <span className="pill">page_number</span>,
              'PageNumberPaginator',
              'base_page (0), page_param ("page"), total_path ("total"), maximum_page, stop_after_empty_page (true)',
            ],
            [
              <span className="pill">offset</span>,
              'OffsetPaginator',
              'limit (REQUIRED), offset (0), offset_param ("offset"), limit_param ("limit"), total_path ("total"), maximum_offset, stop_after_empty_page (true)',
            ],
          ]}
        />

        <h3>Configuring a paginator</h3>
        <CodeBlock
          label="offset paginator with an explicit limit"
          html={OFFSET_PAGINATOR}
        />

        <h3>Auto-detection</h3>
        <p>
          When no paginator is set, dlt's PaginatorFactory inspects the first response and picks in
          priority order: HeaderLinkPaginator (Link header) &gt; JSONLinkPaginator (a next-URL
          field) &gt; PageNumberPaginator / JSONResponseCursorPaginator &gt; SinglePagePaginator
          (fallback). Precedence when resolving which paginator to use:{' '}
          <strong>endpoint &gt; resource_defaults &gt; client</strong>.
        </p>
        <Note variant="tip">
          Single-entity paths ending in a placeholder segment (e.g.{' '}
          <code>/users/{'{id}'}</code>) are auto-assigned SinglePagePaginator with{' '}
          <code>data_selector "$"</code>. For POST APIs that paginate via the request body,
          PageNumberPaginator, OffsetPaginator and the cursor paginator accept{' '}
          <code>*_body_path</code> variants (e.g. <code>page_body_path</code>,{' '}
          <code>offset_body_path</code>, <code>cursor_body_path</code>) instead of the
          query-param form. Use <code>stop_after_empty_page</code> / <code>has_more_path</code> /{' '}
          <code>maximum_*</code> to bound runaway loops.
        </Note>
      </div>
    </section>
  );
}
