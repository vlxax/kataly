
import assert from 'node:assert/strict';
import {buildSidePots} from '../sidepots.js';
let p=buildSidePots([
 {seat:0,committed:10000,folded:false},
 {seat:1,committed:6000,folded:false},
 {seat:2,committed:20000,folded:false}
]);
assert.deepEqual(p,[
 {amount:18000,eligible:[0,1,2],contributors:[0,1,2]},
 {amount:8000,eligible:[0,2],contributors:[0,2]},
 {amount:10000,eligible:[2],contributors:[2]}
]);
p=buildSidePots([
 {seat:0,committed:5000,folded:true},
 {seat:1,committed:5000,folded:false},
 {seat:2,committed:5000,folded:false}
]);
assert.equal(p[0].amount,15000);
assert.deepEqual(p[0].eligible,[1,2]);
console.log('SIDEPOTS_OK');
