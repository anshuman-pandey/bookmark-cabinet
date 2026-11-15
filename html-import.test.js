import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBrowserHTML,mergeBrowserBookmarks} from './html-import.js';
import {exportHTML,MAX_FILE} from './core.js';
const doc=body=>'<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>'+body+'</DL><p>';
let next=0;const parse=raw=>parseBrowserHTML(raw,()=>String(++next));

test('Chrome-style nested folders, entities, unclosed DT/DD, tags and notes',()=>{
 const p=parse(doc('<DT><H3>Work &amp; study</H3><DL><p><DT><H3>日本語</H3><DL><p><DT><A HREF="https://example.org?a=1&amp;b=2" TAGS="research,文献">A &lt; B</A><DD>Keep &amp; review</DL><p></DL><p><DT><A HREF="https://other.test">Outside</A>'));
 assert.equal(p.bookmarks.length,2);assert.equal(p.bookmarks[0].collection,'Work & study / 日本語');
 assert.equal(p.bookmarks[0].url,'https://example.org/?a=1&b=2');assert.equal(p.bookmarks[0].title,'A < B');
 assert.deepEqual(p.bookmarks[0].tags,['research','文献']);assert.equal(p.bookmarks[0].notes,'Keep & review');assert.equal(p.bookmarks[1].collection,'');
});
test('unsupported URLs and duplicates have visible counts; credentials never imported',()=>{
 const p=parse(doc('<DT><A HREF="https://ok.test">First</A><DT><A HREF="https://ok.test/">Second</A>'+['javascript:alert(1)','data:text/html,x','file:///private','https://user:secret@test.org','chrome://settings','/relative'].map(u=>`<DT><A HREF="${u}">No</A>`).join('')));
 assert.equal(p.bookmarks.length,1);assert.equal(p.duplicates,1);assert.equal(p.skipped,6);assert.equal(p.bookmarks[0].title,'First');
});
test('browser export is data only; scripts and resource attributes do not become content',()=>{
 const p=parse(doc('<script>throw Error("executed")</script><iframe src="https://tracker.invalid"></iframe><DT><A HREF="https://ok.test" onclick="bad()"><img src="https://tracker.invalid">Plain <b>text</b></A>'));
 assert.equal(p.bookmarks[0].title,'Plain text');assert.equal(p.bookmarks.length,1);
});
test('existing URL wins, repeat imports are idempotent, input objects unchanged',()=>{
 const incoming=parse(doc('<DT><A HREF="https://ok.test">Imported</A><DT><A HREF="https://new.test">New</A>'));
 const current={version:1,bookmarks:[{...incoming.bookmarks[0],title:'My edited title',notes:'Private notes'}]};
 const before=JSON.stringify(current),first=mergeBrowserBookmarks(current,incoming);
 assert.equal(first.added,1);assert.equal(first.existing,1);assert.equal(first.library.bookmarks[0].notes,'Private notes');
 assert.equal(mergeBrowserBookmarks(first.library,incoming).added,0);assert.equal(JSON.stringify(current),before);
});
test('our HTML export round-trips titles, folders, notes and tags without markup execution',()=>{
 const p=parse(doc('<DT><H3>Read</H3><DL><DT><A HREF="https://a.test" TAGS="one,two">&lt;script&gt;literal&lt;/script&gt;</A><DD>私のメモ</DL>'));
 const again=parse(exportHTML(p));const omit=b=>{const {id,...rest}=b;return rest;};assert.deepEqual(again.bookmarks.map(omit),p.bookmarks.map(omit));
});
test('ordinary pages, empty, unsupported, oversized and deeply nested inputs fail safely',()=>{
 for(const input of ['<html><a href="https://a.test">Not an export</a></html>',doc(''),doc('<DT><A HREF="javascript:bad()">bad</A>'),'x'.repeat(MAX_FILE+1),doc('<DL>'.repeat(110)+'<A HREF="https://ok.test">x</A>'+'</DL>'.repeat(110))])assert.throws(()=>parse(input));
});
test('overlong fields are counted as skipped, oversized notes fail whole preview',()=>{
 const p=parse(doc('<DT><A HREF="https://a.test">'+ 'a'.repeat(201)+'</A><DT><A HREF="https://b.test">Valid</A>'));assert.equal(p.skipped,1);assert.equal(p.bookmarks.length,1);
 assert.throws(()=>parse(doc('<DT><A HREF="https://a.test">Valid</A><DD>'+'x'.repeat(4001))));
});
