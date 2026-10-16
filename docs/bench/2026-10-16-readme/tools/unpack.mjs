// Inflate archived evidence into a fresh review directory; leave captured files unchanged.
import {mkdirSync,readdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
const [source,target]=process.argv.slice(2);
if(!source||!target)throw Error('source and a new target directory required');
mkdirSync(target);
function copy(from,to){
 for(const entry of readdirSync(from,{withFileTypes:true})){
  const input=join(from,entry.name);
  if(entry.isDirectory()){const output=join(to,entry.name);mkdirSync(output);copy(input,output);}
  else if(entry.name.endsWith('.gz'))writeFileSync(join(to,entry.name.slice(0,-3)),gunzipSync(readFileSync(input)));
  else copyFileSync(input,join(to,entry.name));
 }
}
copy(source,target);
