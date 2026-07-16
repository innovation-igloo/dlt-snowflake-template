import { useMemo, useState } from 'react';
import { databases } from '../data/databases';

const tierClass: Record<string, string> = {
  Verified: 'badge tier-verified',
  'SQLAlchemy dialect': 'badge tier-dialect',
  Unofficial: 'badge tier-unofficial',
};

export default function DatabaseCatalog() {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return databases;
    return databases.filter((d) =>
      [d.name, d.urlPrefix, d.driver, d.tier, d.backends, d.gotchas]
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
          placeholder="Search databases, drivers, tiers, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search supported databases"
        />
        <p className="count">
          {filtered.length} of {databases.length} databases
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No databases match "{q}".</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Database</th>
              <th>SQLAlchemy URL prefix</th>
              <th>Driver dep</th>
              <th>Tier</th>
              <th>Backends</th>
              <th>Gotchas</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>
                  <code>{d.urlPrefix}</code>
                </td>
                <td>
                  <code>{d.driver}</code>
                </td>
                <td>
                  <span className={tierClass[d.tier] ?? 'badge'}>{d.tier}</span>
                </td>
                <td>
                  <code>{d.backends}</code>
                </td>
                <td>{d.gotchas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
