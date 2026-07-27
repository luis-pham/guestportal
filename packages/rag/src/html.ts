import { collapseWhitespace } from './normalize.js';

/** Strip HTML tags/scripts while preserving readable text and heading cues. */
export function htmlToText(html: string): { title: string | null; text: string; warnings: string[] } {
  const warnings: string[] = [];
  let working = html;
  if (/<script[\s\S]*?>[\s\S]*?<\/script>/i.test(working)) {
    warnings.push('script_tags_removed');
    working = working.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ');
  }
  if (/<style[\s\S]*?>[\s\S]*?<\/style>/i.test(working)) {
    warnings.push('style_tags_removed');
    working = working.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ');
  }

  const titleMatch = working.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? collapseWhitespace(decodeEntities(titleMatch[1]!)) : null;

  working = working
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return { title, text: collapseWhitespace(decodeEntities(working)), warnings };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}
