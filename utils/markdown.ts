/**
 * Markdown/HTML conversion helpers.
 * These are intentionally conservative to avoid data loss.
 */

const htmlTagPattern = /<\/?[a-z][\s\S]*>/i;

export function looksLikeHtml(value: string): boolean {
  return htmlTagPattern.test(value);
}

export function htmlToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return '';
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return trimmed;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'text/html');
    const markdown = nodeToMarkdown(doc.body).trim();
    return normalizeMarkdown(markdown);
  } catch (error) {
    console.error('HTML to Markdown conversion failed:', error);
    return trimmed;
  }
}

export function markdownToHtml(markdown: string): string {
  const source = markdown.trim();
  if (!source) {
    return '';
  }

  if (looksLikeHtml(source)) {
    return source;
  }

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paragraphLines: string[] = [];
  let quoteLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    html += `<p>${renderInlineMarkdown(paragraphLines.join(' '))}</p>`;
    paragraphLines = [];
  };

  const closeList = () => {
    if (!listType) return;
    html += `</${listType}>`;
    listType = null;
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    const content = quoteLines.map((line) => `<p>${renderInlineMarkdown(line)}</p>`).join('');
    html += `<blockquote>${content}</blockquote>`;
    quoteLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const codeText = escapeHtml(codeLines.join('\n'));
        html += `<pre><code>${codeText}</code></pre>`;
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushQuote();
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      flushQuote();
      closeList();
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      closeList();
      quoteLines.push(line.replace(/^>\s?/, ''));
      continue;
    }

    if (quoteLines.length) {
      flushQuote();
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      const content = renderInlineMarkdown(headingMatch[2].trim());
      html += `<h${level}>${content}</h${level}>`;
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== 'ol') {
        closeList();
      }
      if (!listType) {
        listType = 'ol';
        html += '<ol>';
      }
      html += `<li>${renderInlineMarkdown(orderedMatch[2].trim())}</li>`;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== 'ul') {
        closeList();
      }
      if (!listType) {
        listType = 'ul';
        html += '<ul>';
      }
      html += `<li>${renderInlineMarkdown(unorderedMatch[1].trim())}</li>`;
      continue;
    }

    if (listType) {
      closeList();
    }

    paragraphLines.push(line.trim());
  }

  if (inCodeBlock && codeLines.length) {
    const codeText = escapeHtml(codeLines.join('\n'));
    html += `<pre><code>${codeText}</code></pre>`;
  }

  flushParagraph();
  flushQuote();
  closeList();

  return html;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map(nodeToMarkdown).join('');

  switch (tagName) {
    case 'h1':
      return `# ${children.trim()}\n\n`;
    case 'h2':
      return `## ${children.trim()}\n\n`;
    case 'h3':
      return `### ${children.trim()}\n\n`;
    case 'p':
      return `${children.trim()}\n\n`;
    case 'br':
      return '  \n';
    case 'strong':
    case 'b':
      return `**${children}**`;
    case 'em':
    case 'i':
      return `_${children}_`;
    case 'code':
      return `\`${children}\``;
    case 'pre': {
      const codeText = element.textContent ?? '';
      return `\n\n\`\`\`\n${codeText.trim()}\n\`\`\`\n\n`;
    }
    case 'ul':
      return `${listToMarkdown(element, 'ul')}\n`;
    case 'ol':
      return `${listToMarkdown(element, 'ol')}\n`;
    case 'li':
      return children.trim();
    case 'blockquote': {
      const lines = children.trim().split('\n').map((line) => `> ${line}`);
      return `${lines.join('\n')}\n\n`;
    }
    case 'a': {
      const href = element.getAttribute('href') ?? '';
      const text = children.trim() || href;
      return `[${text}](${href})`;
    }
    case 'img': {
      const assetId = element.getAttribute('data-asset');
      const src = assetId
        ? `remind-asset:${assetId}`
        : element.getAttribute('src') ?? '';
      const alt = element.getAttribute('alt') ?? '';
      return `![${alt}](${src})`;
    }
    default:
      return children;
  }
}

function listToMarkdown(list: HTMLElement, type: 'ul' | 'ol'): string {
  const items = Array.from(list.children).filter(
    (child) => (child as HTMLElement).tagName.toLowerCase() === 'li'
  ) as HTMLElement[];

  return items
    .map((item, index) => {
      const content = nodeToMarkdown(item).trim();
      const prefix = type === 'ol' ? `${index + 1}. ` : '- ';
      return `${prefix}${content}`;
    })
    .join('\n');
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

function renderInlineMarkdown(text: string): string {
  const codeSnippets: string[] = [];
  let prepared = text.replace(/`([^`]+)`/g, (_, code) => {
    const escaped = escapeHtml(code);
    codeSnippets.push(escaped);
    return `{{CODE_${codeSnippets.length - 1}}}`;
  });

  prepared = escapeHtml(prepared);

  prepared = prepared.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" />`;
  });

  prepared = prepared.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `<a href="${escapeAttribute(href)}">${label}</a>`;
  });

  prepared = prepared.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  prepared = prepared.replace(/_([^_]+)_/g, '<em>$1</em>');

  prepared = prepared.replace(/\{\{CODE_(\d+)\}\}/g, (_, index) => {
    const code = codeSnippets[Number(index)] ?? '';
    return `<code>${code}</code>`;
  });

  return prepared;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(text: string): string {
  return text.replace(/"/g, '&quot;');
}
