import VerifiedSourceCatalog from '../../components/VerifiedSourceCatalog';

export default function VerifiedCatalog() {
  return (
    <section className="page">
      <div className="wrap">
        <p className="kicker">SaaS &amp; App Sources</p>
        <h2>Verified source catalog</h2>
        <p className="sub">
          dlt ships ~29 prebuilt sources maintained in the{' '}
          <a
            href="https://github.com/dlt-hub/verified-sources"
            target="_blank"
            rel="noreferrer"
          >
            dlt-hub/verified-sources
          </a>{' '}
          repo. Each source is vendored into your project via{' '}
          <code>dlt init &lt;slug&gt; snowflake</code>, which copies the source
          code locally so you can customise it freely. Use the search box below
          to filter by name, category, auth method, or incremental strategy.
          Note that these are one-way ingestion sources — they read from the
          listed system and write to Snowflake; they do not support bidirectional
          sync.
        </p>
        <VerifiedSourceCatalog />
      </div>
    </section>
  );
}
