import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { Link } from 'react-router-dom';

const linkCls =
  'text-emerald-400 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300';

const components: Components = {
  a: ({ href, children }) => {
    if (href?.startsWith('/')) {
      return (
        <Link to={href} className={linkCls}>
          {children}
        </Link>
      );
    }
    const external = Boolean(href?.startsWith('http'));
    return (
      <a
        href={href}
        className={linkCls}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  },
};

export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}
