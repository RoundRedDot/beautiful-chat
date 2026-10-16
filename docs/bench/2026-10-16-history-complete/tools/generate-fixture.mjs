// A separately named fixture; the incident-shaped source remains unchanged.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function completeFixture(source){
  const rows=source.trim().split('\n').map(line=>JSON.parse(line));let reasoning=0;
  for(const row of rows)if(row.item?.type==='reasoning'){
    const tag=`Synthetic reasoning ${String(++reasoning).padStart(4,'0')}: `;
    row.item.text=tag+row.item.text.slice(tag.length);
  }
  if(reasoning!==260)throw Error('unexpected source shape');
  rows[0]={...rows[0],name:'history-complete-v1',description:'810-item independent comparison; uniquely tagged reasoning; original 59427-character tail reply retained',scenario:'Cold open, older reveal and whole-session unmount/return; not independent-block remount',sourceFixtureSha256:createHash('sha256').update(source).digest('hex')};
  return rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [, ,source,target]=process.argv;if(!source||!target||existsSync(target))throw Error('source and fresh output required');
  const text=completeFixture(readFileSync(source,'utf8'));writeFileSync(target,text);console.log(JSON.stringify({sha256:createHash('sha256').update(text).digest('hex')}));
}
