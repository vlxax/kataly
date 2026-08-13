/* KATALY human pacing v2.0 — loaded before app.js */
import { HoldemDemo } from './poker/engine.js?v=130';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rnd=(a,b)=>a+Math.random()*(b-a);
const P={
  GTO_Monkey:{speed:1.00,tank:.13,timebank:.025}, NitKing:{speed:1.22,tank:.20,timebank:.045},
  BluffDaddy:{speed:1.08,tank:.19,timebank:.055}, CallingStation:{speed:.90,tank:.10,timebank:.020},
  MinRaiseBoss:{speed:.82,tank:.08,timebank:.018}, RiverPolice:{speed:1.28,tank:.25,timebank:.070}
};
function plan(engine,player,legal){
  const p=P[player.nick]||{speed:1,tank:.14,timebank:.03},street=engine.street||'preflop';
  const facing=legal.toCall>0; let lo=street==='preflop'?1.8:2.7,hi=street==='preflop'?5.2:7.0,mode='normal';
  if(facing){lo+=.9;hi+=2.1} if(legal.toCallBB>=5){lo+=.8;hi+=1.5}
  if(street==='turn'){lo+=.8;hi+=1.8} if(street==='river'){lo+=1.3;hi+=3.0}
  let seconds=rnd(lo,hi)*p.speed;
  if(Math.random()<.18&&(!facing||legal.toCallBB<2.5)){seconds=rnd(1.15,2.4);mode='snap'}
  if(Math.random()<p.tank){seconds=rnd(street==='preflop'?7:8.5,street==='river'?15.5:13);mode='tank'}
  if(Math.random()<p.timebank&&(facing||street==='turn'||street==='river')){seconds=rnd(14,22);mode='timebank'}
  seconds=clamp(seconds,1.1,23);return{seconds,ms:Math.round(seconds*1000),mode};
}
const original=HoldemDemo.prototype.botAction;
HoldemDemo.prototype.botAction=async function(player,legal){
  const x=player.__humanThinkPlan||plan(this,player,legal);player.__humanThinkPlan=x;
  await sleep(x.ms);const old=this.botDelayMs;this.botDelayMs=0;
  try{return await original.call(this,player,legal)}finally{this.botDelayMs=old;player.__humanThinkPlan=null}
};
window.__KATALY_PACE_PLAN__=plan;
console.info('[KATALY] human pacing v2 active');
