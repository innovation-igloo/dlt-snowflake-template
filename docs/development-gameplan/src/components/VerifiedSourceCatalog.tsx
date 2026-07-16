import { useMemo, useState } from 'react';
import { verifiedSources } from '../data/verifiedSources';

export default function VerifiedSourceCatalog() {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return verifiedSources;
    return verifiedSources.filter((s) =>
      [s.name, s.category, s.initSlug, s.auth, s.incremental, s.notes]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [q]);

  return (
    <>
      <div className="search">
        <input
          type="search"
          placeholder="Search sources, categories, auth, incremental…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search verified sources"
        />
        <p className="count">
          {filtered.length} of {verifiedSources.length} sources
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No sources match "{q}".</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Category</th>
              <th>dlt init</th>
              <th>Auth</th>
              <th>Incremental</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.initSlug}>
                <td>{s.name}</td>
                <td>{s.category}</td>
                <td>
                  <code>dlt init {s.initSlug} snowflake</code>
                </td>
                <td>{s.auth}</td>
                <td>{s.incremental}</td>
                <td>{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
