const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const context=await browser.newContext(), page=await context.newPage();
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));context.on('request',r=>{if(!r.url().startsWith(process.env.TEST_URL))external.push(r.url());});
  await page.goto(process.env.TEST_URL);
  await page.locator('.browser-migration summary').click();
  const body='<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>研究</H3><DL><p><DT><A HREF="https://a.test" TAGS="one,two" onclick="window.executed=true">First &amp; safe</A><DD>原文 &lt;b&gt;note&lt;/b&gt;<DT><A HREF="https://a.test/">Duplicate</A><DT><A HREF="javascript:alert(1)">Unsafe</A><DT><A HREF="https://b.test">Second</A><img src="https://tracker.invalid/pixel"><iframe src="https://tracker.invalid/page"></iframe><script>window.executed=true</script></DL><p></DL>';
  const upload=async html=>page.locator('#browser-html').setInputFiles({name:'bookmarks.html',mimeType:'text/html',buffer:Buffer.from(html)});
  await upload(body);await page.locator('#browser-preview').waitFor({state:'visible'});
  assert.match(await page.locator('#browser-preview-summary').textContent(),/2 new bookmarks.*1 duplicates.*1 unsupported/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('bookmark-cabinet-v1')),null);
  await page.locator('#browser-import-cancel').click();assert.equal(await page.locator('#browser-preview').isVisible(),false);
  await page.locator('#title').fill('Unsaved draft');await page.locator('#url').fill('https://draft.test');
  await upload(body);await page.locator('#browser-preview').waitFor({state:'visible'});
  await page.locator('[data-language-picker]').selectOption('de');
  if(process.env.IMPORT_SCREENSHOT)await page.screenshot({path:process.env.IMPORT_SCREENSHOT,fullPage:true});
  await page.locator('#browser-import-apply').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent===I18n.t('Imported {0} browser bookmarks. Existing links and your editor draft were kept.',{0:2}));
  assert.equal(await page.locator('#title').inputValue(),'Unsaved draft');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bookmark-cabinet-v1')));
  assert.equal(saved.bookmarks.length,2);assert.equal(saved.bookmarks[0].collection,'研究');assert.equal(saved.bookmarks[0].notes,'原文 <b>note</b>');
  assert.deepEqual(saved.bookmarks[0].tags,['one','two']);assert.equal(await page.evaluate(()=>window.executed),undefined);
  await upload(body);await page.locator('#browser-preview').waitFor({state:'visible'});assert.ok(await page.locator('#browser-import-apply').isDisabled());
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bookmark-cabinet-v1')).revision),saved.revision);
  await page.locator('#browser-import-cancel').click();
  await upload('<html><a href="https://ordinary.test">Webpage</a></html>');
  await page.waitForFunction(()=>document.querySelector('#status').textContent===I18n.t('Choose a browser bookmark HTML export, not a saved webpage.'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bookmark-cabinet-v1')).bookmarks.length),2);
  // A second tab changes storage after preview: never overwrite that revision.
  const fresh='<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://new.test">New</A></DL>';
  await upload(fresh);await page.locator('#browser-preview').waitFor({state:'visible'});
  const other=await context.newPage();await other.goto(process.env.TEST_URL);
  await other.locator('#title').fill('Other tab');await other.locator('#url').fill('https://other.test');await other.locator('#editor').evaluate(e=>e.requestSubmit());
  await other.waitForFunction(()=>JSON.parse(localStorage.getItem('bookmark-cabinet-v1')).bookmarks.length===3);
  await page.locator('#browser-import-apply').click();await page.locator('#browser-preview').waitFor({state:'hidden'});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('bookmark-cabinet-v1')));
  assert.equal(after.bookmarks.length,3);assert.ok(!after.bookmarks.some(b=>b.url==='https://new.test/'));assert.equal(await page.locator('#title').inputValue(),'Unsaved draft');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: HTML preview/cancel, nested Unicode folders, notes/tags, six-locale integration, add-only import, duplicates, unsafe links, no resource requests/script execution, preserved draft, invalid file and stale-tab rejection. Browser HTML fixture only; native bookmark-manager UI not exercised.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
