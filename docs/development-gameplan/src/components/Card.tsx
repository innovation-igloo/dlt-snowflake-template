import type { ReactNode } from 'react';

export default function Card({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="ico">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
