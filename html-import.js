import {parse} from './vendor/html-parser.js';
import {MAX_FILE, safeURL, validate} from './core.js';

// Pure data parsing: no DOM, image loading, scripts, iframe navigation or network.
const blocked = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed']);
function content(node) {
  const parts = [], stack = [node];
  while (stack.length) {
    const item = stack.pop();
    if (blocked.has(item.tagName)) continue;
    if (item.nodeName === '#text') parts.push(item.value);
    else stack.push(...(item.childNodes || []).slice().reverse());
  }
  return parts.join('').trim();
}
function attribute(node, name) {
  return node.attrs?.find(a => a.name === name)?.value || '';
}
export function parseBrowserHTML(raw, id = () => crypto.randomUUID()) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_FILE)
    throw Error('Bookmark HTML must be smaller than 2 MB.');
  const document = parse(raw);
  if (!document.childNodes.some(n => n.nodeName === '#documentType' && n.name.toLowerCase() === 'netscape-bookmark-file-1'))
    throw Error('Choose a browser bookmark HTML export, not a saved webpage.');
  const bookmarks = [], urls = new Set();
  let links = 0, skipped = 0, duplicates = 0, lists = 0;
  function walk(nodes, context, depth) {
    if (depth > 100) throw Error('Bookmark folders are nested too deeply.');
    for (const node of nodes) {
      const tag = node.tagName;
      if (blocked.has(tag)) continue;
      if (tag === 'h3') { context.folder = content(node); context.last = null; }
      else if (tag === 'dl') {
        lists++;
        const path = context.folder ? [...context.path, context.folder] : context.path;
        context.folder = ''; context.last = null;
        walk(node.childNodes || [], {path, folder:'', last:null, inList:true}, depth + 1);
      } else if (tag === 'a' && context.inList) {
        context.last = null;
        if (++links > 5000) throw Error('A bookmark import can contain at most 5,000 links.');
        let url;
        try { url = safeURL(attribute(node, 'href')); }
        catch { skipped++; continue; }
        if (urls.has(url)) {duplicates++; continue;}
        const bookmark = {
          id: id(), url, title: content(node) || url,
          collection: context.path.join(' / '),
          tags: attribute(node, 'tags').split(',').map(s => s.trim()).filter(Boolean), notes:''
        };
        try { validate({version:1, bookmarks:[bookmark]}); }
        catch { skipped++; continue; }
        urls.add(url); bookmarks.push(bookmark); context.last = bookmark;
      } else if (tag === 'dd') {
        if (context.last) {
          const notes = content(node);
          if (notes.length > 4000) throw Error('A bookmark note exceeds 4,000 characters. Nothing was imported.');
          context.last.notes = notes;
        }
      } else if (node.childNodes) walk(node.childNodes, context, depth + 1);
    }
  }
  walk(document.childNodes, {path:[],folder:'',last:null,inList:false}, 0);
  if (!lists || !links) throw Error('No bookmark links were found in this file.');
  if (!bookmarks.length) throw Error('No supported HTTP(S) bookmarks were found. Nothing was imported.');
  return {...validate({version:1,bookmarks}), skipped, duplicates};
}

// HTML migration is add-only. Existing URLs win, including edited titles/notes.
export function mergeBrowserBookmarks(current, incoming) {
  const base = validate(current), imported = validate(incoming);
  const urls = new Set(base.bookmarks.map(b=>b.url));
  const additions = imported.bookmarks.filter(b=>!urls.has(b.url));
  return {library:validate({version:1,bookmarks:[...base.bookmarks,...additions]}),
    added:additions.length, existing:imported.bookmarks.length-additions.length};
}
