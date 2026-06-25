export function markdownInlineCode(value: string): string {
  return `\`${escapeMarkdownText(value)}\``;
}

export function markdownInlineList(values: string[]): string {
  return values.length > 0 ? values.map(markdownInlineCode).join(', ') : 'none';
}

export function escapeMarkdownText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}
