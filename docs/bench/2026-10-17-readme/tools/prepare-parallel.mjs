// Fresh private daemon homes and output roots; retained host sources are read-only inputs.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,symlinkSync,copyFileSync,readdirSync} from 'node:fs';
import {fixtures} from './report.mjs';

const root='/tmp/bc-readme-20261017';
const cli='/tmp/bc-perf-p0p1/paseo-cli/node_modules/.bin/paseo';
const sims=['4497FFF9-93D1-4713-B55B-A9988BC2209E','3AB949E3-BCE2-4751-8AD6-F493384CE4E8','237D4DD2-7BE9-4CB7-B221-8727E32852BC','753E3F5E-D496-4B73-BA9B-E2A0C498BAB0'];
const sh=(file,args)=>execFileSync(file,args,{encoding:'utf8',timeout:180000}).trim();
for(let lane=1;lane<=4;lane++){
  const directory=`${root}/parallel-v2/lane${lane}`,home=`/Users/rrd/.paseo-bench-readme-20261017-v2-lane${lane}`;
  if(existsSync(directory)||existsSync(home))throw Error('fresh isolated roots required');
  for(const path of [directory,home,...['raw/web','raw/ios','logs','tmp','expo-home','fixtures','workspace','history/raw/web','history/raw/ios','history/logs'].map(x=>`${directory}/${x}`)])mkdirSync(path,{recursive:true});
  for(const name of ['candidate','parent'])symlinkSync(`${root}/${name}`,`${directory}/${name}`);
  symlinkSync('/tmp/bc-ios-history/baseline',`${directory}/upstream`);
  symlinkSync(`${directory}/candidate`,`${directory}/active`);
  symlinkSync(`${directory}/candidate`,`${directory}/history/candidate`);
  symlinkSync('/tmp/bc-ios-history/baseline',`${directory}/history/baseline`);
  symlinkSync(`${root}/history/tools`,`${directory}/history/tools`);
  symlinkSync(`${root}/tools`,`${directory}/tools`);
  symlinkSync(`${root}/parallel/lane${lane}/web-dist`,`${directory}/web-dist`);
  writeFileSync(`${directory}/export.status`,'0\n');
  copyFileSync(`${root}/history/fixture.jsonl`,`${directory}/history/fixture.jsonl`);
  for(const [fixture]of fixtures)copyFileSync(`${root}/candidate/test/fixtures/streams/${fixture}.jsonl`,`${directory}/fixtures/${fixture}.jsonl`);
  sh('/bin/cp',['-R',`${root}/candidate/tools/bench-provider`,`${directory}/provider`]);
  symlinkSync('/tmp/bc-v5/latest/tools/bench-provider/node_modules',`${directory}/provider/node_modules`);
  writeFileSync(`${directory}/provider/server/fixtures-dir.generated.ts`,`export const FIXTURES_DIR = ${JSON.stringify(`${directory}/fixtures`)};\n`);
  const config={version:1,daemon:{listen:`127.0.0.1:${6890+lane}`,cors:{allowedOrigins:[`http://127.0.0.1:${8310+lane}`]},relay:{enabled:false}},pluginsEnabled:true,plugins:{'bc-bench':{source:'directory',path:`${directory}/provider`,enabled:true},'better-paseo':{source:'directory',path:`${directory}/active`,enabled:true},'beautiful-chat':{source:'directory',path:'/tmp/bc-ios-history/baseline',enabled:false}}};
  writeFileSync(`${home}/config.json`,JSON.stringify(config,null,2));
  sh(cli,['--home',home,'daemon','start']);
  const workspace=JSON.parse(sh(cli,['--home',home,'workspace','create','--isolation','local','--path',`${directory}/workspace`,'--json']));
  writeFileSync(`${directory}/raw/workspace.json`,JSON.stringify(workspace,null,2));
  const host=lane===1?'/tmp/bc-ios/paseo':`/tmp/bc-ios-five-parallel-20261016/lane${lane}/host`;
  if(sh('git',['-C',host,'rev-parse','HEAD'])!=='75953250959979b8f088bbca8dbd6ee61d0151b1')throw Error('host identity changed');
  const environment={BC_LANE:String(lane),BC_LANE_ROOT:directory,BC_ROOT:directory,BC_BENCH_HOME:home,BC_BENCH_PORT:String(6890+lane),BC_WEB_PORT:String(8310+lane),BC_ACTIVE_LINK:`${directory}/active`,BC_PASEO_BIN:cli,BC_WORKSPACE:workspace.workspaceId,BC_SIM_UDID:sims[lane-1],METRO_PORT:String(8210+lane),BC_FIXTURE_DIR:`${directory}/fixtures`,BC_HOST:host};
  writeFileSync(`${directory}/raw/environment.json`,JSON.stringify({at:new Date().toISOString(),...environment},null,2));
  writeFileSync(`${directory}/environment.sh`,'export PATH=/opt/homebrew/bin:$PATH\n'+Object.entries(environment).map(([key,value])=>`export ${key}='${value}'`).join('\n')+'\n');
  console.log(JSON.stringify({lane,directory,workspace:workspace.workspaceId,daemonPort:6890+lane,webPort:8310+lane,metroPort:8210+lane}));
}
