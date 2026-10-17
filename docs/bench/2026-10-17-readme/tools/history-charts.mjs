import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function historyCharts(repo){
  const summary=JSON.parse(readFileSync(`${repo}/docs/bench/2026-10-17-readme/parallel-v2/history/raw/summary.json`));
  if(summary.collected!==80||(summary.structuralFailures??summary.failures).length||summary.groups.length!==36)throw Error('complete audited 80-run history required');
  const get=(platform,scenario,mode,phase)=>{
    const g=summary.groups.find(g=>g.platform===platform&&g.scenario===scenario&&g.mode===mode&&g.phase===phase);
    if(g?.diagnosticOnly)return null;
    if(!g||g.n!==(mode==='candidate'?10:5)||!Number.isFinite(g.metrics.rows?.median))throw Error('missing history cell');
    return g.metrics.rows.median;
  };
  for(const lang of ['en','zh'])for(const phase of ['open','sessionRemount']){
    const zh=lang==='zh',font='Arial, PingFang SC, sans-serif';
    const groups=['web','ios'].flatMap(platform=>['incident','multi-turn'].map(scenario=>({platform,scenario,values:['native','baseline','candidate'].map(mode=>get(platform,scenario,mode,phase))})));
    const max=Math.max(1,...groups.flatMap(g=>g.values).filter(Number.isFinite))*1.2;
    const title=phase==='open'?(zh?'长历史：冷打开行渲染总量':'Long history: cold-open row-render work'):(zh?'长历史：整体会话返回行渲染总量':'Long history: whole-session return row-render work');
    const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420" role="img"><title>${title}</title><rect width="900" height="420" rx="10" fill="white" stroke="#d8e1e5"/>`,
      `<text x="24" y="30" font-family="${font}" font-size="16">${title}${zh?'（毫秒，越低越好）':' (ms, lower is better)'}</text>`,
      `<text x="24" y="52" font-family="${font}" font-size="12" fill="#61727a">2026-10-17 · history-complete-v1 · b9dfae6 · ${zh?'默认配置；最多 4 组并行':'defaults; up to four concurrent groups'}</text>`];
    groups.forEach((g,i)=>{
      const y=88+i*78;
      svg.push(`<text x="24" y="${y+24}" font-family="${font}" font-size="13">${g.platform==='ios'?'iOS':'Web'} ${g.scenario==='incident'?'810 / 1':'832 / 12'}</text>`);
      g.values.forEach((value,slot)=>{
        const yy=y+slot*18,w=value/max*510,name=(zh?['不开插件','Beautiful Chat','Better Paseo']:['No plugin','Beautiful Chat','Better Paseo'])[slot];
        if(value===null){svg.push(`<text x="155" y="${yy+11}" font-family="${font}" font-size="11">${name}</text><text x="265" y="${yy+11}" font-family="${font}" font-size="11">N/A</text>`);return;}
        svg.push(`<text x="155" y="${yy+11}" font-family="${font}" font-size="11">${name}</text><rect x="260" y="${yy}" width="${w.toFixed(1)}" height="12" fill="${['#9fadb3','#d99a2b','#1e6b57'][slot]}"/><text x="${(265+w).toFixed(1)}" y="${yy+11}" font-family="${font}" font-size="11">${value.toFixed(1)}</text>`);
      });
    });
    svg.push(`<text x="24" y="404" font-family="${font}" font-size="11" fill="#61727a">${zh?'实际并发有变化；iOS 为开发版模拟器，不代表真机性能':'Actual overlap varies; iOS is a development simulator, not physical-device performance'}</text>`,'</svg>');
    writeFileSync(`${repo}/docs/perf/readme/history-complete-${phase==='open'?'open':'return'}.${lang}.svg`,svg.join('\n')+'\n');
  }
}
if(process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(import.meta.url))historyCharts(resolve(process.argv[2]??'.'));
