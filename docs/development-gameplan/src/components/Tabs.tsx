import { useState } from 'react';
import type { ReactNode } from 'react';

export interface TabDef {
  label: string;
  content: ReactNode;
}

/**
 * In-page tab switcher using local state (no routing). Use to chunk a dense
 * page into sections. Reuses the .tabs / .tabpanel styles.
 */
export default function Tabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <div className="tabs">
        {tabs.map((t, i) => (
          <a
            key={t.label}
            className={i === active ? 'active' : undefined}
            onClick={() => setActive(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setActive(i);
            }}
          >
            {t.label}
          </a>
        ))}
      </div>
      <div className="tabpanel">{tabs[active].content}</div>
    </>
  );
}
