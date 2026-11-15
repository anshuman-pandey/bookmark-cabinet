# Bring your browser bookmarks into Link Alcove

Link Alcove accepts Netscape-style bookmark HTML exports. The file is read locally, parsed as data and previewed before anything is saved. No browser account or cloud service is involved.

1. Export an HTML bookmark file using your browser's bookmark manager. Google documents [Chrome's HTML export](https://support.google.com/chrome/answer/96816?hl=en); Mozilla documents [Firefox's HTML export](https://support.mozilla.org/en-US/kb/export-firefox-bookmarks-to-backup-or-transfer). These references were checked on 15 November 2026. For other browsers, choose their bookmark HTML export rather than a saved webpage or a full browsing-data archive.
2. Open **Import browser bookmarks**, choose the `.html` file and review the counts and first five supported links. You can cancel without changing your library.
3. Choose **Add reviewed bookmarks**. Existing URLs retain their saved title, tags, collection and notes. Your editor draft stays in place.
4. Export a JSON backup after migration. JSON preserves every Link Alcove field; browser HTML is intended for interchange.

Folder paths become flat collection labels such as `Work / Research`. The first occurrence of each normalized URL wins within a file. HTTP and HTTPS links without embedded credentials are supported. Bookmarklets, browser-internal pages, file URLs, relative URLs and invalid records are skipped and counted in the preview. Empty folders, icons and browser timestamps are not imported. Overlong folder names or titles make that entry invalid; an overlong note rejects the preview rather than silently truncating it. Limits: 2 MB, 5,000 links and bounded nesting. The existing library's size and count limits still apply.

If another tab changes the library after the preview, saving is rejected. Reload the library and choose the file again for a fresh preview. Export a backup before reloading if your current editor draft matters. A damaged library must be restored with the existing JSON recovery workflow before HTML migration.

## Verification and limits

`npm test` covers nested folders, Unicode, entities, notes, tags, duplicates, unsafe URLs, size/depth limits, export round trips and add-only merging. `npm run test:import` exercises the real browser interface against disposable storage: review/cancel, import, preserving drafts, refusing stale writes, translated controls and zero resource requests from imported HTML. Fixtures imitate the common browser HTML format; the native Chrome/Firefox/Safari/Edge bookmark-manager UIs have not been exercised in this environment.

The bundled parser is parse5, with its entities dependency. Their MIT notices are in `vendor/THIRD_PARTY_LICENSES.txt`. Rebuild the checked-in browser bundle with `npm ci && npm run build:parser`; no CDN or runtime npm installation is needed to use the packaged app.

## Launch handoff

Local preparation only. This branch includes the staged six-locale update and requires the owner's Link Alcove publication go-ahead. After authorization, push the reviewed branch and run the repository CI before merging. This feature provides a concrete migration demonstration for people evaluating a local alternative to Raindrop.io: existing browser library → preview → searchable collections → portable backup. A reproducible migration example belongs in the product README; no third-party listing, social post or acceptance is claimed.
