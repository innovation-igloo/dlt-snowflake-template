import { Fragment } from 'react';

export interface FlowNode {
  icon: string;
  title: string;
  sub: string;
  variant?: 'src' | 'dest';
}

export default function Flow({ nodes }: { nodes: FlowNode[] }) {
  return (
    <div className="flow">
      {nodes.map((n, idx) => (
        <Fragment key={n.title}>
          <div className={`node${n.variant ? ' ' + n.variant : ''}`}>
            <div className="chip">{n.icon}</div>
            <b>{n.title}</b>
            <small>{n.sub}</small>
          </div>
          {idx < nodes.length - 1 && <div className="arrow">&rarr;</div>}
        </Fragment>
      ))}
    </div>
  );
}
