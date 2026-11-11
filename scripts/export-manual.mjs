import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qa=path.join(root,".qa"); fs.mkdirSync(qa,{recursive:true});
const port=4174, debug=9334, origin="http://127.0.0.1:"+port;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn(process.execPath,["scripts/serve.mjs"],{cwd:root,env:{...process.env,PORT:String(port)},windowsHide:true,stdio:"ignore"});
const chrome=process.env.CHROME_PATH||"C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser=spawn(chrome,["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-port="+debug,"--user-data-dir="+path.join(qa,"browser-profile"),"--window-size=390,844","about:blank"],{windowsHide:true,stdio:"ignore"});
let ws;const pending=new Map();let counter=0;const exceptions=[];const findings={};
async function retry(url,options){for(let i=0;i<100;i++){try{const r=await fetch(url,options);if(r.ok)return r;}catch{}await delay(100);}throw Error("Unavailable "+url);}
async function connect(){await retry(origin+"/index.html");const target=await (await retry("http://127.0.0.1:"+debug+"/json/new?about:blank",{method:"PUT"})).json();ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});ws.addEventListener("message",event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);if(entry){clearTimeout(entry.timer);pending.delete(data.id);if(data.error)entry.reject(Error(JSON.stringify(data.error)));else entry.resolve(data.result);}}else if(data.method==="Runtime.exceptionThrown")exceptions.push(data.params.exceptionDetails.text);});}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++counter;const timer=setTimeout(()=>{pending.delete(id);reject(Error("Timeout "+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function navigate(url){await send("Page.navigate",{url});await delay(250);for(let i=0;i<80;i++){if(await evaluate('document.readyState==="complete"'))break;await delay(50);}await evaluate("document.fonts.ready.then(()=>true)");}
async function size(width,height=844,mobile=true){await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile});}
async function screenshot(name){const r=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});fs.writeFileSync(path.join(qa,name),Buffer.from(r.data,"base64"));}

try {
 await connect(); await send("Page.enable"); await send("Runtime.enable");
 await size(794,1123,false); await navigate(origin+"/index.html");
 const contents=await evaluate(`(()=>{
  document.querySelectorAll('details').forEach(el=>el.open=true);
  const fields=[...document.querySelectorAll('#report-form .form-grid label')].map(el=>el.textContent.trim());
  const section=document.createElement('section');section.className='section offline-report';
  const heading=document.createElement('h2');heading.textContent='사고보고 시 전달할 내용';section.append(heading);
  const note=document.createElement('p');note.textContent='안전 확보 후 확인한 내용만 전달하고, 모르는 항목은 미확인으로 구분하세요.';section.append(note);
  const list=document.createElement('ul');fields.forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li)});section.append(list);
  document.querySelector('.sources').before(section);
  const location=document.createElement('p');location.textContent='신고 위치: 도로명·진행 방향·인근 IC·휴게소·거리 표지를 함께 확인하세요. 좌표만으로 도로명이나 진행 방향을 판단하지 마세요.';section.append(location);
  const style=document.createElement('style');
  style.textContent='@page{size:A4 portrait;margin:14mm 12mm 17mm} @media print{body{font-size:11pt;line-height:1.55;background:white}.layout{max-width:none;display:block;padding:0}.intro{margin-bottom:16px}h1{font-size:23pt}h2{font-size:16pt}h3{font-size:14pt}.step{padding:14px;margin-bottom:12px}.step ul{font-size:11pt;margin:10px 0}.step-lead{font-size:10pt}.step,.tool-card,details{break-inside:avoid}.section-heading{break-after:avoid}.side-column{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}.tool-card{padding:14px}.tool-card:has(#print-link),.mode-card,#location,#report,dialog,.bottom-actions,.skip,.text-link{display:none!important}.tool-card label,.tool-card select{display:none}.situations{display:block}.situations details{margin-bottom:10px}.situations summary{padding:12px;font-size:12pt}.situations details>div{font-size:11pt}.report-section{display:none}.offline-report{margin-top:22px}.offline-report p,.offline-report li{font-size:11pt}.offline-report ul{columns:2}.site-footer{padding:12px 0 0}.sources li,.sources p{font-size:9pt}.button{font-size:11pt;min-height:36px;padding:8px}.header-inner{padding:6px 0 15px}.header-tag{display:none}.brand img{max-height:50px}.full-column{margin-top:16px}}';
  document.head.append(style);
  return {steps:document.querySelectorAll('[data-step]').length,situations:document.querySelectorAll('details[open]').length,reportFields:fields.length,insurance:document.querySelector('[data-insurance]').textContent,branch:document.querySelector('.brand img').alt,version:document.querySelector('[data-version]').textContent};
 })()`);
 assert.equal(contents.steps,6);assert.equal(contents.situations,4);assert.equal(contents.reportFields,10);assert.ok(contents.insurance.includes('1688-1688'));
 await send('Emulation.setEmulatedMedia',{media:'print'});await screenshot('full-manual-print-preview.png');
 const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,generateTaggedPDF:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;margin:0 12mm;font-size:8px;color:#53677d;display:flex;justify-content:space-between"><span>한국산업인력공단 강원동부지사 · 공용차 교통사고 대응</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'});
 const bytes=Buffer.from(pdf.data,'base64');const pages=(bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
 assert.ok(pages>=2&&pages<=10,'Unexpected PDF page count '+pages);
 fs.writeFileSync(path.join(root,'downloads/vehicle-accident-manual.pdf'),bytes);
 const result={...contents,pages,bytes:bytes.length,file:'downloads/vehicle-accident-manual.pdf'};
 fs.writeFileSync(path.join(qa,'manual-pdf-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} catch(error){console.error(error);process.exitCode=1;} finally {if(ws){try{await send("Browser.close")}catch{}ws.close();}browser.kill();server.kill();}
