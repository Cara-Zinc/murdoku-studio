/* Reproduce the 9 promo images using original project puzzles only.
 * PLAYWRIGHT_MODULE may point to an existing Playwright installation.
 * Run from the repository root with Studio listening on port 8000.
 */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..'), out=path.join(root,'output/promo');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const image=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
  const context=await browser.newContext({viewport:{width:1380,height:1100},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8000/');
  await page.locator('.cell').first().waitFor();await page.locator('#ui-language').selectOption('zh-CN');
  const shot=async(name,locator)=>{const file=path.join(out,name+'.png');await locator.screenshot({path:file});return file;};
  await page.locator('[data-cell="1"]').click();
  const cover=await shot('source-cover',page.locator('#board'));
  await page.locator('.clue-card[data-person="B"]').click();await page.locator('[data-cell="10"]').click();
  const overview=await shot('source-overview',page.locator('body'));
  const board=await shot('source-board',page.locator('#board'));
  await page.locator('[data-mode="note"]').click();await page.locator('.clue-card[data-person="C"]').click();await page.locator('[data-cell="17"]').click();
  await page.locator('.clue-card[data-person="D"]').click();await page.locator('[data-cell="17"]').click();
  await page.locator('[data-mode="color"]').click();await page.locator('[data-cell="21"]').click();
  await page.locator('[data-mode="ink"]').click();
  const box=await page.locator('#board').boundingBox();
  for(let step=0;step<=40;step++){
    const angle=step/40*Math.PI*2,x=box.x+box.width*5.5/6+Math.cos(angle)*box.width*.065,y=box.y+box.height*2.5/6+Math.sin(angle)*box.height*.065;
    await page.mouse.move(x,y);if(step===0)await page.mouse.down();
  }await page.mouse.up();
  const notes=await shot('source-notes',page.locator('#board-wrap'));
  const people=await shot('source-people',page.locator('.clue-panel'));
  await page.locator('#edit-btn').click();await page.locator('#patterns-tab').click();
  await page.waitForFunction(()=>!document.querySelector('#pattern-rescan').disabled&&document.querySelectorAll('.pattern-group').length>0);
  await page.locator('.pattern-group').first().scrollIntoViewIfNeeded();
  const first=await page.locator('.pattern-group').first().boundingBox(),third=await page.locator('.pattern-group').nth(2).boundingBox();
  const patterns=path.join(out,'source-patterns.png');await page.screenshot({path:patterns,clip:{x:first.x,y:first.y,width:first.width,height:third.y+third.height-first.y}});
  await page.locator('button[data-close="editor-dialog"]').last().click();
  const chinese=await shot('source-zh',page.locator('body'));
  await page.locator('#ui-language').selectOption('en');const english=await shot('source-en',page.locator('body'));
  await page.locator('#ui-language').selectOption('zh-CN');await page.locator('#library-btn').click();
  const library=await shot('source-library',page.locator('#library-dialog'));
  const slides=[
    {title:'我把 Murdoku<br>搬进了电脑',sub:'一个让你自己推理的解谜工作台',image:cover,label:'MURDOKU STUDIO',note:'PDF / 图片导入 · 原创练习题可直接体验'},
    {title:'放一个人<br>同行同列自动排除',sub:'确定位置，就落一个字母。',image:board,label:'01 / 放置人物',note:'黑叉帮你记住已经排除的位置'},
    {title:'不确定？<br>先记下来',sub:'候选小字母 + 标色 + 手绘圈重点',image:notes,label:'02 / 推理笔记',note:'随时撤销、重做，留住每一步思路'},
    {title:'线索就在<br>棋盘旁边',sub:'头像、姓名和线索放在一起。',image:people,label:'03 / 人物线索',note:'导入结果可以核对、修改'},
    {title:'大地图<br>也能慢慢查',sub:'看局部，用小地图找方向。',image:path.join(root,'docs/images/large-map.png'),label:'04 / 侦探放大镜',note:'配图为原创 24×24 导航测试场景',wide:true},
    {title:'桌子还是地板？<br>你来标',sub:'相似图案先分组，再填名称和类别。',image:patterns,label:'05 / 物品分组',note:'地板 / 可占用 / 不可占用 · 分组可纠正',wide:true},
    {title:'中文 / English<br>随手切换',sub:'界面换语言，题目原文保留下来。',images:[chinese,english],label:'06 / 双语界面',note:'同一个原创练习案件，两个界面版本'},
    {title:'关掉窗口<br>下次接着查',sub:'本机保存，JSON 导出备份。',image:library,label:'07 / 保留进度',note:'清理浏览器数据前，记得先导出'},
    {title:'想试一题？<br>先从练习案件开始',sub:'Murdoku Studio · 独立爱好者工具',image:overview,label:'来体验 / 欢迎反馈',note:'非官方项目 · 配图为原创练习案件',link:true}
  ];
  const poster=await context.newPage();await poster.setViewportSize({width:1080,height:1440});
  const files=[];
  for(const [i,slide]of slides.entries()){
    const pictures=(slide.images||[slide.image]).map(file=>`<img src="${image(file)}">`).join('');
    await poster.setContent(`<!doctype html><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;width:1080px;height:1440px;background:#f5f0e5;color:#252631;font-family:'PingFang SC','Microsoft YaHei',sans-serif;overflow:hidden}
      .page{padding:70px 62px;height:100%;display:flex;flex-direction:column;position:relative;background-image:radial-gradient(#ddd5c6 1px,transparent 1px);background-size:18px 18px}
      .label{font-size:23px;font-weight:700;letter-spacing:2px;color:#516e73;display:flex;justify-content:space-between}
      h1{font-size:72px;line-height:1.19;letter-spacing:-2px;margin:30px 0 18px;font-weight:850}p{font-size:30px;line-height:1.5;margin:0 0 32px;color:#666575}
      .visual{flex:1;min-height:0;padding:24px;background:#fffdf6;border:3px solid #252631;border-radius:24px;box-shadow:10px 12px 0 #d8c9ae;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;overflow:hidden}
      .visual img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;min-height:0;flex:1}.pair img{width:100%;height:50%;object-fit:contain}
      .visual.wide{padding:18px}.visual.wide img{width:100%;object-fit:contain}.link{font-size:37px;line-height:1.4;background:#dbe8e6;border:2px solid #252631;border-radius:14px;padding:22px 28px;margin-top:28px;font-weight:650}
      .footer{display:flex;justify-content:space-between;gap:15px;font-size:23px;line-height:1.5;margin-top:34px}.footer strong{white-space:nowrap;color:#a94c33}
    </style><div class="page"><div class="label"><span>${slide.label}</span><span>${String(i+1).padStart(2,'0')} / 09</span></div><h1>${slide.title}</h1><p>${slide.sub}</p><div class="visual ${slide.wide?'wide':''} ${slide.images?'pair':''}">${pictures}</div>${slide.link?'<div class="link">项目链接<br>github.com/Cara-Zinc/murdoku-studio</div>':''}<div class="footer"><span>${slide.note}</span><strong>自己推理 🔎</strong></div></div>`);
    await poster.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
    const file=path.join(out,`${String(i+1).padStart(2,'0')}.png`);await poster.screenshot({path:file});files.push(file);
  }
  await poster.setViewportSize({width:1080,height:1440});
  await poster.setContent(`<style>body{margin:0;background:#d8d4cb;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px}img{width:100%}</style>${files.map(file=>`<img src="${image(file)}">`).join('')}`);
  await poster.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
  await poster.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({images:9,size:'1080×1440',errors,source:'Original practice case and original navigation fixture'},null,2));
  await browser.close();console.log(out);
})().catch(error=>{console.error(error);process.exit(1)});
