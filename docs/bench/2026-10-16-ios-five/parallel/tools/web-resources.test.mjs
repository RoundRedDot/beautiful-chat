import {test} from 'node:test';import assert from 'node:assert/strict';import {parseWebProcesses} from './web-resources.mjs';
test('Web worker enumeration accepts both bare and absolute node commands',()=>{
 const rows=parseWebProcesses(' 123 100 node /tmp/bc-ios-five-parallel-20261016/tools/web-runner.mjs 2\n 124 100 /opt/homebrew/bin/node /tmp/bc-ios-five-parallel-20261016/tools/web-runner.mjs 3');
 assert.deepEqual(rows.map(({pid,ppid})=>({pid,ppid})),[{pid:123,ppid:100},{pid:124,ppid:100}]);
});
test('Web enumeration excludes unrelated applications',()=>assert.deepEqual(parseWebProcesses(' 125 100 node /tmp/other.mjs\n 126 100 Google Chrome'),[]));
