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
try{
 await connect();await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
 findings.widths=[];
 for(const width of [320,390,768,1280]){
  await size(width,width===1280?900:844,width<900);await navigate(origin+"/index.html");
  const result=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,logo:document.querySelector(".brand img").currentSrc,loaded:document.querySelector(".brand img").naturalWidth,firstStep:document.querySelector("#step-1").getBoundingClientRect().top,emergency:document.querySelector(".intro .emergency").getBoundingClientRect().bottom,stepCount:document.querySelectorAll("[data-step]").length})');
  assert.ok(result.scroll<=width,"Horizontal overflow "+JSON.stringify(result));assert.ok(result.loaded>0);assert.equal(result.stepCount,6);
  assert.ok(result.logo.endsWith(width<900?"logo-horizontal-b.png":"logo-horizontal-a.png"));
  if(width<=390){assert.ok(result.firstStep<700);assert.ok(result.emergency<600);}
  findings.widths.push(result);
  if(width===390)await screenshot("mobile-390.png");if(width===1280)await screenshot("desktop-1280.png");
 }
 await size(390);
 await navigate(origin+"/index.html");
 const normal=await evaluate('[...document.querySelectorAll("[data-internal-contacts]")].map(e=>[...e.querySelectorAll("a")].map(a=>({text:a.textContent,href:a.getAttribute("href")})))');
 assert.equal(normal.length,2);for(const pair of normal)assert.deepEqual(pair.map(p=>p.href),["tel:0336505744","tel:0336505745"]);findings.contactAreas=normal;
 const commonInsurance=await evaluate('[...document.querySelectorAll("[data-insurance] a")].map(a=>a.getAttribute("href"))');
 assert.deepEqual(commonInsurance,['tel:16881688','tel:16881688']);findings.commonInsurance=commonInsurance;
 await evaluate('document.querySelector("#start-mode").click()');
 for(let i=0;i<2;i++)await evaluate('document.querySelector("#next-step").click()');
 const fieldInsurance=await evaluate('({href:document.querySelector("#mode-content [data-insurance] a").getAttribute("href"),text:document.querySelector("#mode-content [data-insurance]").textContent})');
 assert.equal(fieldInsurance.href,'tel:16881688');assert.ok(fieldInsurance.text.includes('흥국화재'));findings.fieldInsurance=fieldInsurance;
 for(let i=0;i<2;i++)await evaluate('document.querySelector("#next-step").click()');
 const mode=await evaluate('({open:document.querySelector("dialog").open,phones:[...document.querySelectorAll("#mode-content .phone")].map(a=>a.getAttribute("href")),overflow:document.querySelector("dialog").scrollWidth>document.querySelector("dialog").clientWidth,title:document.querySelector("#mode-content h3").textContent})');
 assert.ok(mode.open);assert.deepEqual(mode.phones,["tel:0336505744","tel:0336505745"]);assert.equal(mode.overflow,false);findings.mode=mode;
 await screenshot("field-report-390.png");
 await evaluate('document.querySelector("#next-step").click();document.querySelector("#next-step").click()');assert.equal(await evaluate('document.querySelector("dialog").open'),false);
 await send("Browser.setPermission",{permission:{name:"geolocation"},setting:"denied",origin});
 await evaluate('document.querySelector("#locate").click()');await delay(150);
 assert.equal(await evaluate('document.querySelector("#locate").disabled'),false);
 findings.geolocationDenied=await evaluate('document.querySelector("#location-status").textContent');
 await evaluate('Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:(ok,fail)=>fail({code:2})}});document.querySelector("#locate").click()');
 findings.geolocationFailure=await evaluate('document.querySelector("#location-status").textContent');
 await evaluate('document.querySelector("#location-text").value="Manual road location";Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:()=>Promise.reject(Error("denied"))}});document.querySelector("#copy-location").click()');await delay(100);
 assert.equal(await evaluate('document.querySelector("#location-text").selectionEnd'),20);findings.locationCopyFallback=true;
 await evaluate('document.querySelector("#report-form").requestSubmit();document.querySelector("#copy-report").click()');await delay(100);
 const report=await evaluate('({value:document.querySelector("#report-output").value,start:document.querySelector("#report-output").selectionStart,end:document.querySelector("#report-output").selectionEnd,status:document.querySelector("#report-status").textContent})');assert.equal(report.start,0);assert.equal(report.end,report.value.length);findings.reportCopyFallback=report.status;
 await evaluate('document.querySelector("#report-form").reset()');assert.equal(await evaluate('document.querySelector("#report-output").value'),"");
 await navigate(origin+"/index.html?vehicle=unknown");
 assert.equal(await evaluate('document.querySelector("[data-insurance] a").getAttribute("href")'),'tel:16881688');
 assert.equal(await evaluate('document.querySelector("#report-plate").value'),'');findings.unknownVehicleCommonInsurance=true;
 await send("Emulation.setScriptExecutionDisabled",{value:true});await navigate(origin+"/index.html");
 assert.equal(await evaluate('document.querySelectorAll("[data-step]").length'),6);assert.equal(await evaluate('document.querySelectorAll("[data-internal-contacts] a").length'),4);findings.noJavascript=true;
 assert.equal(await evaluate('document.querySelectorAll("[data-insurance] a[href="+JSON.stringify("tel:16881688")+"]").length'),2);
 await navigate(origin+"/print.html");
 const staticQr=await evaluate('({image:document.querySelector("[data-qr] img")?.naturalWidth||0,target:document.querySelector("[data-card-url]").textContent})');
 if(await evaluate('Boolean(window.MANUAL_CONFIG)'))throw Error('Scripts unexpectedly ran in static print check');
 assert.ok(staticQr.image>0,'Static print QR did not load without JavaScript');
 findings.noJavascriptPrint=staticQr;
 await send("Emulation.setScriptExecutionDisabled",{value:false});await navigate(origin+"/print.html");
 const productionTarget=await evaluate('window.MANUAL_UTILS.deploymentTarget(window.MANUAL_CONFIG.deploymentUrl)');
 assert.equal(await evaluate('document.querySelectorAll("[data-qr] svg").length'),productionTarget?1:0);
 findings.productionQr=await evaluate('document.querySelector("[data-card-url]").textContent');
 if(productionTarget)assert.equal(findings.productionQr,productionTarget);
 const insuranceCard=await evaluate('({text:document.querySelector("[data-card-vehicle]").textContent,href:document.querySelector("[data-card-vehicle] a").getAttribute("href")})');
 assert.equal(insuranceCard.href,'tel:16881688');assert.ok(insuranceCard.text.includes('흥국화재'));findings.insuranceCard=insuranceCard;
 // Decode the exported PNG, exported SVG and the actual 35mm card QR independently.
 if(productionTarget&&fs.existsSync(path.join(qa,'jsQR.js'))){
  await evaluate(fs.readFileSync(path.join(qa,'jsQR.js'),'utf8'));
  const decoded=await evaluate(`(async()=>{const results={};for(const [key,source]of [['png','./downloads/manual-qr.png'],['svg','./downloads/manual-qr.svg'],['card',document.querySelector('[data-qr] svg')]]){let url=source;if(key==='card')url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)],{type:'image/svg+xml'}));const img=new Image();img.src=url;await img.decode();const size=key==='card'?132:Math.max(img.naturalWidth,600);const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,size,size);ctx.drawImage(img,0,0,size,size);results[key]=window.jsQR(ctx.getImageData(0,0,size,size).data,size,size)?.data||null;if(key==='card')URL.revokeObjectURL(url);}return results;})()`);
  for(const value of Object.values(decoded))assert.equal(value,productionTarget);
  findings.independentQrDecode=decoded;
 }
 const cardFit=await evaluate('({w:document.querySelector(".qr-card").clientWidth,h:document.querySelector(".qr-card").clientHeight,scrollH:document.querySelector(".qr-card").scrollHeight,logo:document.querySelector(".card-logo img").currentSrc,phones:[...document.querySelectorAll("[data-internal-contacts] a")].map(a=>a.getAttribute("href"))})');
 assert.ok(cardFit.scrollH<=cardFit.h+1,JSON.stringify(cardFit));assert.deepEqual(cardFit.phones,["tel:0336505744","tel:0336505745"]);findings.cardFit=cardFit;
 await size(800,1000,false);await screenshot("card-a6.png");
 function paper(data,w,h){const bytes=Buffer.from(data,"base64");const m=bytes.toString("latin1").match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);assert.ok(m,"Missing paper size");assert.ok(Math.abs(Number(m[1])-w)<2&&Math.abs(Number(m[2])-h)<2,JSON.stringify(m));return{width:Number(m[1]),height:Number(m[2])};} findings.paperSizes={};let pdf=await send("Page.printToPDF",{printBackground:true,preferCSSPageSize:true});findings.paperSizes.a6=paper(pdf.data,297.64,419.53);fs.writeFileSync(path.join(qa,"card-a6-review.pdf"),Buffer.from(pdf.data,"base64"));
 if(productionTarget){
  fs.copyFileSync(path.join(qa,'card-a6-review.pdf'),path.join(root,'downloads/vehicle-card-a6.pdf'));
  await send('Emulation.setEmulatedMedia',{media:'print'});
  const fit=await evaluate(`(()=>{const card=document.querySelector('.qr-card');const r=card.getBoundingClientRect();return {height:r.height,scroll:card.scrollHeight,children:[...card.children].every(el=>el.getBoundingClientRect().bottom<=r.bottom+1)}})()`);
  assert.ok(fit.children,'A6 card content extends beyond print boundary');
  findings.productionPrintFit=fit;
  await screenshot('card-a6-production.png');
  await send('Emulation.setEmulatedMedia',{media:''});
 }
 await evaluate('document.querySelector("#paper-size").value="a4";document.querySelector("#paper-size").dispatchEvent(new Event("change"))');
 assert.equal(await evaluate('document.querySelectorAll(".qr-card").length'),4);
 pdf=await send("Page.printToPDF",{printBackground:true,preferCSSPageSize:true});findings.paperSizes.a4=paper(pdf.data,595.28,841.89);fs.writeFileSync(path.join(qa,"card-a4-review.pdf"),Buffer.from(pdf.data,"base64"));
 if(productionTarget)fs.copyFileSync(path.join(qa,'card-a4-review.pdf'),path.join(root,'downloads/vehicle-cards-a4.pdf'));
 // Use transient QA data in memory only; do not register fictitious production vehicles.
 await evaluate('window.MANUAL_CONFIG.deploymentUrl="https://qa-user.github.io/manual/index.html";window.MANUAL_CONFIG.vehicles.push({id:"qa-a",plate:"QA-A",model:"QA",insurer:"Insurer A",accidentPhone:"0211112222"},{id:"qa-b",plate:"QA-B",model:"QA",insurer:"Insurer B",accidentPhone:"0233334444"});const option=document.createElement("option");option.value="qa-b";document.querySelector("#vehicle-select").append(option);document.querySelector("#vehicle-select").value="qa-b";document.querySelector("#vehicle-select").dispatchEvent(new Event("change"))');
 const qaCard=await evaluate('({url:document.querySelector("[data-card-url]").textContent,vehicle:document.querySelector("[data-card-vehicle]").textContent,phone:document.querySelector("[data-card-vehicle] a").getAttribute("href"),svg:document.querySelectorAll("[data-qr] svg").length,quietZone:document.querySelector("[data-qr] svg").getAttribute("viewBox")})');
 assert.equal(qaCard.url,"https://qa-user.github.io/manual/index.html?vehicle=qa-b");assert.equal(qaCard.phone,"tel:0233334444");assert.equal(qaCard.svg,4);findings.vehicleQr=qaCard;
 await navigate(origin+"/index.html");await send("Page.reload",{ignoreCache:true});await delay(250);assert.equal(await evaluate('document.querySelectorAll("[data-step]").length'),6);findings.directReload=true;
 assert.deepEqual(exceptions,[]);findings.runtimeExceptions=exceptions;
 fs.writeFileSync(path.join(qa,"browser-results.json"),JSON.stringify(findings,null,2));console.log(JSON.stringify(findings));
}catch(error){console.error(error);process.exitCode=1;}finally{if(ws){try{await send("Browser.close")}catch{}ws.close();}browser.kill();server.kill();}
