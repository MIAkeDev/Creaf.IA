import { Fragment, type ReactNode } from 'react';
import './FormattedMessage.css';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return <Fragment key={index}>{part.split('\u2028').map((line, i) => <Fragment key={i}>{i > 0 && <br/>}{line}</Fragment>)}</Fragment>;
  });
}
const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
const tableRule = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*\|/.test(line);

// A small display-only Markdown subset. HTML is never injected or executed.
export function FormattedMessage({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n')
    .replace(/&lt;br\s*\/?&gt;|<br\s*\/?\s*>|\bbr>/gi, '\u2028')
    .replace(/<[^>\n]*>/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.includes('|') && i + 1 < lines.length && tableRule(lines[i + 1])) {
      const headers = cells(line); const rows: string[][] = []; i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      blocks.push(<div key={blocks.length} className="answer-table-scroll" role="region" aria-label="Tabla de la respuesta" tabIndex={0}><table><thead><tr>{headers.map((cell, j) => <th key={j} scope="col">{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, j) => <tr key={j}>{headers.map((_, k) => <td key={k}>{inline(row[k] || '')}</td>)}</tr>)}</tbody></table></div>);
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push(<p className="answer-heading" key={blocks.length}>{inline(line.replace(/^#{1,6}\s+/, ''))}</p>); i++;
    } else if (/^\s*(?:[-*+] |\d+[.)] )/.test(line)) {
      const ordered = /^\s*\d/.test(line); const items: ReactNode[] = [];
      const pattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      while (i < lines.length && pattern.test(lines[i])) items.push(<li key={items.length}>{inline(lines[i++].replace(pattern, ''))}</li>);
      blocks.push(ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    } else if (/^```/.test(line)) {
      const code: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>);
    } else {
      const paragraph = [line]; i++;
      while (i < lines.length && lines[i].trim() && !/^#{1,6}\s|^\s*(?:[-*+] |\d+[.)] )|^```/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && tableRule(lines[i + 1]))) paragraph.push(lines[i++]);
      blocks.push(<p key={blocks.length}>{inline(paragraph.join('\n'))}</p>);
    }
  }
  return <div className="formatted-message">{blocks}</div>;
}
