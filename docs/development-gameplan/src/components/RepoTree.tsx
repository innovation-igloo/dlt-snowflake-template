/**
 * Renders a monospace repo tree. Content is a pre-formatted HTML string so the
 * box-drawing characters, indentation, and .dir/.cmt coloring are preserved
 * exactly (whitespace matters here, hence the raw string in a <pre>).
 */
export default function RepoTree({ html }: { html: string }) {
  return <div className="tree" dangerouslySetInnerHTML={{ __html: html }} />;
}
