import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output=path.join(root,"_site");
fs.mkdirSync(output,{recursive:true});
for(const name of ["index.html","print.html","styles.css","print.css","config.js","logic.js","app.js",".nojekyll","assets","vendor","downloads"]) {
  fs.cpSync(path.join(root,name),path.join(output,name),{recursive:true});
}
console.log("Static Pages artifact prepared: _site");
