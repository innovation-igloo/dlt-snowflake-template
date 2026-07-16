import { Fragment, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navGroups, type NavItem } from '../data/nav';

/** Index of the group whose item best matches the current path (-1 if none). */
function activeGroupIndex(pathname: string): number {
  let best = -1;
  let bestLen = -1;
  navGroups.forEach((g, gi) => {
    g.items.forEach((it) => {
      const match = it.path === '/' ? pathname === '/' : pathname.startsWith(it.path);
      if (match && it.path.length > bestLen) {
        best = gi;
        bestLen = it.path.length;
      }
    });
  });
  return best;
}

function railLink(item: NavItem) {
  return (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => (isActive ? 'active' : undefined)}
    >
      {item.label}
    </NavLink>
  );
}

export default function SideNav() {
  const { pathname } = useLocation();
  const activeGi = activeGroupIndex(pathname);
  const [open, setOpen] = useState<Set<number>>(() => new Set(activeGi >= 0 ? [activeGi] : []));

  // Auto-open the group that owns the current route as you navigate.
  useEffect(() => {
    if (activeGi < 0) return;
    setOpen((prev) => (prev.has(activeGi) ? prev : new Set(prev).add(activeGi)));
  }, [activeGi]);

  const toggle = (gi: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(gi) ? next.delete(gi) : next.add(gi);
      return next;
    });

  return (
    <aside className="rail">
      <NavLink to="/" className="brand">
        dlt &rarr; <span className="accent">Snowflake</span>
        <small>Build Gameplan</small>
      </NavLink>
      <nav className="railnav">
        {navGroups.map((group, gi) => {
          // Ungrouped sections (no label) always show their items.
          if (!group.label) {
            return <Fragment key={`group-${gi}`}>{group.items.map(railLink)}</Fragment>;
          }
          const isOpen = open.has(gi);
          return (
            <div className="railsection" key={group.label}>
              <button
                type="button"
                className={`railgroup${isOpen ? ' open' : ''}`}
                aria-expanded={isOpen}
                onClick={() => toggle(gi)}
              >
                <span>{group.label}</span>
                <span className="chev" aria-hidden="true">
                  &#9656;
                </span>
              </button>
              {isOpen && group.items.map(railLink)}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
