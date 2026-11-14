export const MAX_FILE = 2 * 1024 * 1024;
function text(v, max, label) {
  if (typeof v !== 'string' || v.length > max) throw Error(`${label} must be text under ${max} characters.`);
  return v.trim();
}
export function safeURL(value) {
  const raw = text(value, 4000, 'URL');
  let url;
  try { url = new URL(raw); } catch { throw Error('Enter a complete https:// or http:// URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw Error('Only HTTP(S) links without embedded credentials are allowed.');
  return url.href;
}
export function validate(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.bookmarks) || value.bookmarks.length > 5000)
    throw Error('Expected a version 1 backup with at most 5,000 bookmarks.');
  const ids = new Set(), urls = new Set();
  const bookmarks = value.bookmarks.map(b => {
    if (!b || typeof b !== 'object') throw Error('Invalid bookmark.');
    const id = text(b.id, 100, 'ID'), title = text(b.title, 200, 'Title'), url = safeURL(b.url);
    if (!id || !title || ids.has(id) || urls.has(url)) throw Error('Each bookmark needs a title, unique ID and unique URL.');
    ids.add(id); urls.add(url);
    if (!Array.isArray(b.tags) || b.tags.length > 30) throw Error('Use at most 30 tags.');
    return {id, title, url, collection: text(b.collection, 100, 'Collection'),
      tags: [...new Set(b.tags.map(t => text(t, 60, 'Tag')).filter(Boolean))], notes: text(b.notes, 4000, 'Notes')};
  });
  return {version: 1, bookmarks};
}
export function parseBackup(raw) {
  if (new TextEncoder().encode(raw).length > MAX_FILE) throw Error('Backup exceeds 2 MB.');
  try { return validate(JSON.parse(raw)); } catch(e) { throw Error(`Invalid backup: ${e.message}`); }
}
export function merge(current, incoming) {
  const result = [...current.bookmarks];
  for (const b of incoming.bookmarks) {
    const exists = result.find(x => x.id === b.id || x.url === b.url);
    if (exists) {
      if (JSON.stringify(exists) !== JSON.stringify(b)) throw Error('A bookmark conflicts with a saved ID or URL. No changes made; use replace only after exporting your library.');
    } else result.push(b);
  }
  return validate({version: 1, bookmarks: result});
}
export function matches(b, query, collection) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const haystack = [b.title,b.url,b.collection,b.notes,...b.tags].join(' ').toLocaleLowerCase();
  return (!collection || b.collection === collection) && words.every(w => haystack.includes(w));
}
const escape = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function exportHTML(value) {
  const {bookmarks} = validate(value);
  const groups = new Map();
  for (const b of bookmarks) {if (!groups.has(b.collection)) groups.set(b.collection, []); groups.get(b.collection).push(b);}
  let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  for (const [group, items] of groups) {
    if (group) html += `<DT><H3>${escape(group)}</H3>\n<DL><p>\n`;
    for (const b of items) html += `<DT><A HREF="${escape(b.url)}" TAGS="${escape(b.tags.join(','))}">${escape(b.title)}</A>\n<DD>${escape(b.notes)}\n`;
    if (group) html += '</DL><p>\n';
  }
  return html + '</DL><p>\n';
}
