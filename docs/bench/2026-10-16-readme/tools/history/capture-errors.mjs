import {readFileSync,writeFileSync} from 'node:fs';
const [directory,log]=process.argv.slice(2);
if(!directory||!log)throw Error('raw directory and Metro log required');
const pattern=/ ERROR |Invariant Violation|Invalid hook call|Encountered two children with the same key/;
const lines=readFileSync(log,'utf8').split('\n').filter(line=>pattern.test(line));
writeFileSync(`${directory}/metro-errors.json`,JSON.stringify({capturedAt:new Date().toISOString(),filter:pattern.source,lines},null,2));
console.log(JSON.stringify({errorLines:lines.length}));
