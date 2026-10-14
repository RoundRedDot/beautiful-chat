import { readFileSync } from "node:fs";
const lines = readFileSync("/tmp/bc-perf-p0p1/cand/test/fixtures/streams/diff-large.jsonl","utf8").trim().split("\n").map(l=>JSON.parse(l));
const diff = lines.find(l=>l.item?.detail?.unifiedDiff).item.detail.unifiedDiff;
function fnv1a(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16);}
const body = diff.split("\n").filter(l=>!/^(---|\+\+\+|@@)/.test(l)).map(l=>l.slice(1)).join("\n");
const numbers = diff.split("\n").map((_,i)=>i%3?i:null);
const key = () => ["light","", "f", String(diff.length), fnv1a(diff), fnv1a(body)].join("\u0000");
const maxSpread = () => Math.max(...numbers.map(n=>n??0));
for (let i=0;i<200;i++){key();maxSpread();}
const t=(f,n)=>{const a=[];for(let r=0;r<7;r++){const s=performance.now();for(let i=0;i<n;i++)f();a.push((performance.now()-s)/n);}a.sort((x,y)=>x-y);return a[3];};
console.log(JSON.stringify({diffChars:diff.length, bodyChars:body.length, lines:numbers.length, keyMs:t(key,200).toFixed(4), maxSpreadMs:t(maxSpread,500).toFixed(4)}));
