import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = {window:{}, URL};
vm.createContext(context);
for (const file of ['config.js','logic.js','vendor/qrcode.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const target = context.window.MANUAL_UTILS.deploymentTarget(context.window.MANUAL_CONFIG.deploymentUrl);
assert.ok(target, 'Set a valid verified production deploymentUrl first.');
const response = await fetch(target,{cache:'no-store',redirect:'error'});
assert.equal(response.status,200,'The production manual must be reachable before exporting its QR.');
const html = await response.text();
for (const text of ['공용차 교통사고 대응','강원동부지사','tel:0336505744','tel:0336505745'])
  assert.ok(html.includes(text),'Unexpected target page: '+text);

const qr = context.qrcode(0,'Q');
qr.addData(target,'Byte'); qr.make();
const modules = qr.getModuleCount(), quiet = 4, scale = 30;
assert.ok(modules<=77,'Use a shorter stable production URL.');
const extent = modules+quiet*2, size = extent*scale;
const svg = qr.createSvgTag(scale,quiet*scale)
  .replace(/width="[^"]+"/,'width="35mm"')
  .replace(/height="[^"]+"/,'height="35mm"')
  .replace('<svg ','<svg role="img" aria-label="공용차 사고대응 매뉴얼 QR코드" ');

// Lossless 8-bit grayscale PNG. Integer module sizes preserve sharp print edges.
const raw = Buffer.alloc((size+1)*size,255);
for(let y=0;y<size;y++){
  raw[y*(size+1)]=0;
  const row=Math.floor(y/scale)-quiet;
  for(let x=0;x<size;x++){
    const col=Math.floor(x/scale)-quiet;
    if(row>=0&&row<modules&&col>=0&&col<modules&&qr.isDark(row,col))
      raw[y*(size+1)+x+1]=0;
  }
}
function crc32(data){
  let crc=0xffffffff;
  for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data){
  const name=Buffer.from(type), length=Buffer.alloc(4), checksum=Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([length,name,data,checksum]);
}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;
const physical=Buffer.alloc(9);physical.writeUInt32BE(23622,0);physical.writeUInt32BE(23622,4);physical[8]=1;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),
  chunk('pHYs',physical),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const output=path.join(root,'downloads');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'manual-qr.svg'),svg);
fs.writeFileSync(path.join(output,'manual-qr.png'),png);
fs.mkdirSync(path.join(root,'.qa'),{recursive:true});
fs.writeFileSync(path.join(root,'.qa/qr-export.json'),JSON.stringify({target,status:response.status,
  modules,quietZone:quiet,pngPixels:size,printSvgMillimeters:35,dpi:600},null,2));
console.log(JSON.stringify({target,pixels:size,quietZone:quiet,files:['downloads/manual-qr.png','downloads/manual-qr.svg']}));
