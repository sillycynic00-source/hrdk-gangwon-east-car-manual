import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const context={window:{},URL}; vm.createContext(context);
vm.runInContext(read("logic.js"),context); vm.runInContext(read("config.js"),context);
const u=context.window.MANUAL_UTILS, c=context.window.MANUAL_CONFIG;
assert.equal(c.internalContact.label,"강원동부지사 안전담당");
assert.deepEqual([...c.internalContact.phones],["033-650-5744","033-650-5745"]);
assert.equal(u.phoneInfo("033-650-5744").href,"tel:0336505744");
assert.equal(u.phoneInfo("033-650-5745").href,"tel:0336505745");
assert.equal(c.insurance.insurer,'흥국화재');
assert.equal(u.phoneInfo(c.insurance.accidentPhone).href,'tel:16881688');
assert.equal(u.resolveInsurance(null,c.insurance).insurer,'흥국화재');
assert.equal(u.resolveInsurance({id:'qa-common'},c.insurance).accidentPhone,'1688-1688');
assert.equal(u.resolveInsurance({insurer:'Other insurer'},c.insurance).accidentPhone,'');
assert.equal(u.resolveInsurance({insurer:'Other insurer',accidentPhone:'0212345678'},c.insurance).accidentPhone,'0212345678');
assert.equal(u.phoneInfo("javascript:alert(1)"),null);
const fixtures=[{id:"qa-a",plate:"QA-A",insurer:"QA insurer A",accidentPhone:"0211112222"},{id:"qa-b",plate:"QA-B",insurer:"QA insurer B",accidentPhone:"0233334444"}];
assert.equal(u.selectVehicle(fixtures,"unknown"),null);
assert.equal(u.selectVehicle(fixtures,"qa-b").plate,"QA-B");
assert.equal(u.selectVehicle([...fixtures,fixtures[0]],"qa-a"),null);
assert.equal(u.deploymentTarget("",null),null);
assert.equal(u.deploymentTarget("http://localhost/index.html",null),null);
assert.equal(u.deploymentTarget("https://example.com/index.html",null),null);
assert.equal(u.deploymentTarget("https://user.github.io/manual/index.html","qa-b"),"https://user.github.io/manual/index.html?vehicle=qa-b");
assert.equal(u.deploymentTarget("https://user.github.io/manual/print.html",null),null);
assert.match(u.createReport({injury:"확인 중"}),/인명피해 여부: 확인 중/);
assert.match(u.createReport({}),/인명피해 여부: 미확인/);
assert.ok(!u.createReport({}).includes("피해 없음"));
for(const name of ["index.html","print.html"]){
 const html=read(name);
 for(const match of html.matchAll(/(?:src|href|srcset)="\.\/([^"#?]+)[^"]*"/g))assert.ok(fs.existsSync(path.join(root,match[1])),"Missing asset "+match[1]);
 const links=[...html.matchAll(/href="tel:([0-9]+)"/g)].map(m=>m[1]);
 assert.ok(links.includes("0336505744")&&links.includes("0336505745"));
 assert.ok(links.includes('16881688'),'Missing static insurance phone: '+name);
 assert.equal((html.match(/033-650-5744<\/a>/g)||[]).length,name==="index.html"?2:1);
 assert.equal((html.match(/033-650-5745<\/a>/g)||[]).length,name==="index.html"?2:1);
 assert.ok(!/https?:\/\/[^"]+\.(?:css|js|png)/.test(html),"External runtime asset");
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]); assert.equal(new Set(ids).size,ids.length);
}
assert.equal((read("index.html").match(/data-step="/g)||[]).length,6);
for(const file of ["app.js","logic.js","config.js","scripts/serve.mjs","scripts/package.mjs"]){
 const check=spawnSync(process.execPath,["--check",path.join(root,file)],{encoding:"utf8"});
 assert.equal(check.status,0,check.stderr);
}
const forbidden=/\uacbd\uae30\uc11c\ubd80\uc9c0\uc0ac|SK\ub80c\ud130\uce74|032[- ]?719[- ]?(0811|0802)/i;
for(const name of ["index.html","print.html","styles.css","print.css","app.js","logic.js","config.js"])assert.ok(!forbidden.test(read(name)),"Legacy content found: "+name);
for(const name of ["logo-horizontal-a.png","logo-horizontal-b.png","logo-vertical.png"]){
 const bytes=fs.readFileSync(path.join(root,"assets",name));
 assert.equal(bytes.subarray(1,4).toString(),"PNG");
 assert.ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);
}
const qrContext={};vm.createContext(qrContext);vm.runInContext(read("vendor/qrcode.js"),qrContext);
const qr=qrContext.qrcode(0,"Q");qr.addData("https://user.github.io/manual/index.html?vehicle=qa-b","Byte");qr.make();
assert.ok(qr.getModuleCount()<=77); assert.ok(qr.createSvgTag(4,16).includes("<svg"));
console.log("PASS: contacts, six static steps, safe vehicle selection, missing report values, deployment URLs, local assets, original PNG formats, JS syntax, local QR generation.");
