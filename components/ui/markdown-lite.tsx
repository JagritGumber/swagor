import { Fragment } from "react";

/**
 * Minimal markdown renderer for the subset the plan-compiler emits:
 *  - "## heading" lines become h3
 *  - "- bullet" lines become a ul/li block (consecutive bullets group)
 *  - **bold** inline within text becomes <strong>
 *  - blank lines separate blocks
 *
 * Trusted source only (LLM output we control). No HTML injection: every
 * leaf is a React text node or <strong>, never dangerouslySetInnerHTML.
 */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

export function MarkdownLite({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-5 list-disc space-y-1 text-sm leading-relaxed text-foreground">
        {items.map((b, i) => (<li key={i}>{renderInline(b)}</li>))}
      </ul>,
    );
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushBullets();
      blocks.push(
        <h3 key={`h-${blocks.length}`} className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground first:mt-0">
          {renderInline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
    } else if (line.length === 0) {
      flushBullets();
    } else {
      flushBullets();
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm leading-relaxed text-foreground">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushBullets();

  return <div className="space-y-2">{blocks}</div>;
}
