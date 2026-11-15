import {validate, parseBackup, safeURL, matches, merge, exportHTML, MAX_FILE} from './core.js';
import {KEY,readStore,writeStore,recoverStore} from './storage.js';
const $ = id => document.getElementById(id);
let state, broken = false, rawRecovery;
const status = message => I18n.text($('status'), message);
function download(name, data, type) {
 const url = URL.createObjectURL(new Blob([data],{type})); const a = document.createElement('a');
 a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function clear() { $('editor').reset(); $('id').value=''; $('delete').hidden=true; I18n.text($('editor-title'), 'New bookmark'); }
function render() {
 const chosen=$('filter').value, groups=[...new Set(state.bookmarks.map(b=>b.collection).filter(Boolean))].sort();
 $('filter').replaceChildren(I18n.option('All collections',''),...groups.map(g=>new Option(g,g))); $('filter').value=groups.includes(chosen)?chosen:'';
 $('collections').replaceChildren(...groups.map(g=>new Option(g,g)));
 const shown=state.bookmarks.filter(b=>matches(b,$('search').value,$('filter').value));
 I18n.text($('count'), "{0} of {1} bookmarks", {0: shown.length, 1: state.bookmarks.length}); $('empty').hidden=shown.length>0;
 I18n.text($('empty'), state.bookmarks.length?'No bookmarks match these filters.':'No saved links yet. Add your first bookmark to start a collection.');
 $('list').replaceChildren(...shown.map(b=>{
  const li=document.createElement('li'), a=document.createElement('a'), meta=document.createElement('p'), notes=document.createElement('p'), edit=document.createElement('button');
  a.href=b.url;a.textContent=b.title;a.target='_blank';a.rel='noopener noreferrer';
  meta.className='meta';meta.textContent=[new URL(b.url).hostname,b.collection,...b.tags.map(t=>'#'+t)].filter(Boolean).join(' · ');
  notes.textContent=b.notes;I18n.text(edit, 'Edit');edit.className='quiet';edit.setAttribute('aria-label',`Edit ${b.title}`);
  edit.onclick=()=>{for(const key of ['id','title','url','collection','notes'])$(key).value=b[key];$('tags').value=b.tags.join(', ');$('delete').hidden=false;I18n.text($('editor-title'), 'Edit bookmark');$('title').focus();};
  li.append(a,meta,notes,edit);return li;
 }));
}
function load() {
 try {state=readStore();broken=false;rawRecovery=undefined;render();status('Library loaded.');}
 catch(e){broken=true;state=null;$('list').replaceChildren();I18n.text($('status'), "Saved library could not be read. Export raw recovery data before replacing it. {0}", {0:I18n.t(e.message)});}
}
async function save(change,message) {
 if(broken)throw Error('Export raw recovery data and restore a valid backup first.');
 state=await writeStore(state.revision,change);render();status(message);
}
$('editor').onsubmit=async event=>{event.preventDefault();try{
 const b={id:$('id').value||crypto.randomUUID(),title:$('title').value,url:safeURL($('url').value),collection:$('collection').value,tags:$('tags').value.split(',').map(t=>t.trim()).filter(Boolean),notes:$('notes').value};
 await save(s=>validate({version:1,bookmarks:[...s.bookmarks.filter(x=>x.id!==b.id),b]}),'Bookmark saved.');clear();
}catch(e){I18n.text($('status'), "Not saved: {0}", {0:I18n.t(e.message)});}};
$('delete').onclick=async()=>{if(!confirm(I18n.t('Delete this bookmark? Export a backup first if you need to keep it.')))return;try{const id=$('id').value;await save(s=>({...s,bookmarks:s.bookmarks.filter(b=>b.id!==id)}),'Bookmark deleted.');clear();}catch(e){I18n.text($('status'), "Not deleted: {0}", {0:I18n.t(e.message)});}};
$('new').onclick=()=>{clear();$('title').focus();};
for(const id of ['search','filter'])$(id).addEventListener('input',()=>{if(state)render();});
$('backup').onclick=()=>{try{download('bookmark-cabinet.json',JSON.stringify(readStore(),null,2),'application/json');status('Backup exported.');}catch(e){status(e.message);}};
$('html').onclick=()=>{try{download('bookmarks.html',exportHTML(readStore()),'text/html');status('Browser bookmarks exported.');}catch(e){status(e.message);}};
$('raw').onclick=()=>{try{rawRecovery=localStorage.getItem(KEY);download('bookmark-recovery.txt',rawRecovery??'','text/plain');status('Raw recovery data exported.');}catch(e){status(e.message);}};
$('reload').onclick=()=>{if(confirm(I18n.t('Discard the editor draft and reload saved bookmarks?'))){clear();load();}};
$('file').onchange=async()=>{try{
 const file=$('file').files[0];if(!file)return;if(file.size>MAX_FILE)throw Error('Backup exceeds 2 MB.');const incoming=parseBackup(await file.text());const replace=$('mode').value==='replace';
 if(replace&&!confirm(I18n.t('Replace the entire saved library with this backup? Export first to keep existing links.')))return;
 if(broken){if(!replace||rawRecovery===undefined)throw Error('Export raw recovery data, then choose replace to recover.');state=await recoverStore(rawRecovery,incoming);broken=false;render();}
 else await save(s=>replace?incoming:merge(s,incoming),'Imported library.');
 clear();status('Imported library.');
}catch(e){I18n.text($('status'), "Import canceled: {0}", {0:I18n.t(e.message)});}finally{$('file').value='';}};
window.addEventListener('storage',e=>{if(e.key===KEY)status('Library changed in another tab. Your draft is preserved; export or copy it before reloading.');});
load();

// Browser migration is deliberately separate from JSON restore and never replaces data.
let browserImport = null, browserImportGeneration = 0;
function dismissBrowserImport() {
 browserImportGeneration++; browserImport=null; $('browser-preview').hidden=true; $('browser-import-apply').disabled=true;
 $('browser-preview-list').replaceChildren();
}
$('browser-import-cancel').onclick=dismissBrowserImport;
$('browser-html').onchange=async()=>{
 dismissBrowserImport();
 const generation=browserImportGeneration;
 try {
  if(broken || !state) throw Error('Restore the saved library before importing browser bookmarks.');
  const file=$('browser-html').files[0];if(!file)return;
  if(file.size>MAX_FILE)throw Error('Bookmark HTML must be smaller than 2 MB.');
  const {parseBrowserHTML,mergeBrowserBookmarks}=await import('./html-import.js');
  const raw=await file.text();
  if(generation!==browserImportGeneration)return;
  const incoming=parseBrowserHTML(raw);
  const preview=mergeBrowserBookmarks(state,incoming);
  browserImport={incoming,revision:state.revision};
  I18n.text($('browser-preview-summary'),'{0} new bookmarks · {1} already saved · {2} duplicates in file · {3} unsupported or invalid entries skipped',
   {0:preview.added,1:preview.existing,2:incoming.duplicates,3:incoming.skipped});
  $('browser-preview-list').replaceChildren(...incoming.bookmarks.slice(0,5).map(b=>{
   const li=document.createElement('li');li.textContent=[b.title,b.collection,b.url].filter(Boolean).join(' · ');return li;
  }));
  $('browser-preview').hidden=false;$('browser-import-apply').disabled=!preview.added;
  status('Review the import below. Nothing has been saved yet.');
 }catch(e){if(generation===browserImportGeneration)status(e.message);}finally{if(generation===browserImportGeneration)$('browser-html').value='';}
};
$('browser-import-apply').onclick=async()=>{
 if(!browserImport)return;
 const preview=browserImport;$('browser-import-apply').disabled=true;
 $('browser-html').disabled=true;$('browser-import-cancel').disabled=true;
 try {
  const {mergeBrowserBookmarks}=await import('./html-import.js');let added=0;
  state=await writeStore(preview.revision,current=>{
   const merged=mergeBrowserBookmarks(current,preview.incoming);added=merged.added;return merged.library;
  });
  render();dismissBrowserImport();
  I18n.text($('status'),'Imported {0} browser bookmarks. Existing links and your editor draft were kept.',{0:added});
 } catch(e) {
  // Require a fresh preview after stale data, quota or storage errors.
  dismissBrowserImport();status(e.message);
 } finally { $('browser-html').disabled=false;$('browser-import-cancel').disabled=false; }
};
