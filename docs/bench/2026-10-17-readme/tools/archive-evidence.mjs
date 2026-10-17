// Read-only, explicit evidence allowlist; never traverse daemon homes or symlinks.
import {readdirSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [root,output]=process.argv.slice(2);
if(root!=='/tmp/bc-readme-20261017'||!output?.startsWith('/tmp/'))throw Error('explicit retained campaign and temporary output required');
const files=[];
function walk(path){
  const stat=lstatSync(path);if(stat.isSymbolicLink())return;
  const name=relative(root,path);
  if(stat.isDirectory()){
    if(!name||/^(raw|logs|smoke-1)(\/|$)/.test(name)||/^(parallel|parallel-v2)$/.test(name)||/^(parallel|parallel-v2)\/lane[1-4]$/.test(name)||/^(parallel|parallel-v2)\/lane[1-4]\/(raw|logs|smoke-1)(\/|$)/.test(name)||/^parallel-v2\/lane[1-4]\/history(\/(raw|logs)(\/.*)?)?$/.test(name)||/^parallel-v2\/(raw|history)(\/(raw|web|ios)(\/.*)?)?$/.test(name))for(const entry of readdirSync(path))walk(join(path,entry));
    return;
  }
  const allowed=/^(raw|logs|smoke-1)\//.test(name)||/^(candidate|parent|upstream)-source\.json\.gz$/.test(name)||/^(parallel|parallel-v2)\/[^/]+\.(json|md|gz|log|status)$/.test(name)||/^(parallel|parallel-v2)\/lane[1-4]\/(environment\.sh|activity\.json|[^/]+\.status)$/.test(name)||/^(parallel|parallel-v2)\/lane[1-4]\/(raw|logs|smoke-1)\//.test(name)||/^parallel-v2\/lane[1-4]\/history\/(raw|logs)\//.test(name)||/^parallel-v2\/(raw|history\/raw)\//.test(name)||/^parallel-v2\/history\/RESULTS\.md$/.test(name);
  if(allowed)files.push({path:name,bytes:stat.size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));
writeFileSync(output+'.manifest.json',JSON.stringify({at:new Date().toISOString(),files},null,2));
writeFileSync(output+'.files',files.map(f=>f.path).join('\n')+'\n');
execFileSync('/usr/bin/tar',['-czf',output,'-C',root,'-T',output+'.files'],{timeout:180000});
console.log(JSON.stringify({files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),archiveSha256:createHash('sha256').update(readFileSync(output)).digest('hex')}));
