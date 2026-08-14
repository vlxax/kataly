import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const maintained=[
  'core-vnext.mjs',
  'engine-trust.mjs',
  'tournament-edge-cases.mjs',
  'seeded-engine.mjs',
  'smart-preflop.mjs',
  'poker-brain-confidence.mjs',
  'pot-fuzz.mjs',
  'sidepots.mjs',
  'dealflow.mjs',
  'smoke.mjs',
  'v09.mjs',
  'v1events.mjs',
  'v8-regression.mjs',
  'view-contract.mjs'
];

for(const file of maintained){
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{
    stdio:'inherit',
    timeout:20_000
  });
  if(result.error){
    console.error(`TEST_RUNNER_ERROR ${file}: ${result.error.message}`);
    process.exit(1);
  }
  if(result.status!==0){
    console.error(`TEST_FAILED ${file}`);
    process.exit(result.status||1);
  }
}

console.log(`KATALY_MAINTAINED_SUITE_OK (${maintained.length} files)`);
