
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HoldemDemo} from '../engine.js';

const g=new HoldemDemo({players:[
 {nick:'Hero',type:'bot'},{nick:'A',type:'bot'},{nick:'B',type:'bot'},
 {nick:'C',type:'bot'},{nick:'D',type:'bot'},{nick:'E',type:'bot'}
],heroNick:'Nobody',stackBB:100,botDelayMs:0,eventPaceMs:0,levelSeconds:99999});

assert.ok(g.preflopOpenScore({position:'UTG'}) > g.preflopOpenScore({position:'BTN'}),'BTN must open wider than UTG');
assert.ok(g.preflopOpenScore({position:'HJ'}) > g.preflopOpenScore({position:'CO'}),'CO must open wider than HJ');

const strong={seat:1,nick:'A',position:'BTN',hole:['A♠','A♥'],stack:9900,bet:100,totalBet:100,folded:false,out:false,allIn:false};
g._testSetState({players:[
 strong,
 {seat:2,nick:'B',position:'BB',hole:['7♠','2♥'],stack:9900,bet:100,totalBet:100}
],currentBet:100,lastFullRaise:100,pot:200});
const p=g.players[0];
const legal=g.legalFor(p,true);
const power=g.preflopStrength(p.hole);
const d=g.preflopDecision(p,legal,power);
assert.equal(d.type,'raise','AA on BTN should not fold/check in unopened pot');
g.destroy();

const view=fs.readFileSync(new URL('../tableView.js',import.meta.url),'utf8');
assert.ok(view.includes('data-mult="3"'),'3bet raise-to multiplier presets missing');
assert.ok(view.includes('RAISE TO <b>'),'raise-to confirmation missing');
console.log('V19_RANGES_OK');
