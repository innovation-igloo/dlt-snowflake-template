import type { ReactNode } from 'react';

export default function Note({
  variant,
  children,
}: {
  variant?: 'tip' | 'warn';
  children: ReactNode;
}) {
  return (
    <div className={`note${variant ? ' ' + variant : ''}`}>
      <p>{children}</p>
    </div>
  );
}
