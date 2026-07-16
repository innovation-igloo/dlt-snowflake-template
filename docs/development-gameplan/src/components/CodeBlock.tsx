/**
 * Code sample block. `html` is a pre-formatted, pre-colored HTML string (using
 * .kw/.str/.cmt/<b> spans) so syntax coloring and exact whitespace are preserved.
 * Content is static and authored in-repo (no user input).
 */
export default function CodeBlock({ label, html }: { label?: string; html: string }) {
  return (
    <>
      {label && <p className="code-label">{label}</p>}
      <pre dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
