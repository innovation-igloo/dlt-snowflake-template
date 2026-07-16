import { useNavigate, useLocation } from 'react-router-dom';
import { nav, navIndexForPath } from '../data/nav';

export default function Pager() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const i = navIndexForPath(pathname);
  const prev = i > 0 ? nav[i - 1] : null;
  const next = i < nav.length - 1 ? nav[i + 1] : null;

  return (
    <div className="pager">
      <button
        className="prev"
        type="button"
        disabled={!prev}
        onClick={() => prev && navigate(prev.path)}
      >
        <span className="pdir">&larr; Previous</span>
        <span className="ptitle">{prev ? prev.label : ''}</span>
      </button>
      <button
        className="next"
        type="button"
        disabled={!next}
        onClick={() => next && navigate(next.path)}
      >
        <span className="pdir">Next &rarr;</span>
        <span className="ptitle">{next ? next.label : ''}</span>
      </button>
    </div>
  );
}
