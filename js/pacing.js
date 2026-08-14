/* KATALY human pacing v3.0 — poker-natural decision rhythm */
import { HoldemDemo } from './poker/engine.js?v=300';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function cancellableSleep(engine,ms){
  let left=Math.max(0,ms);
  while(left>0&&!engine.destroyed){
    const chunk=Math.min(120,left);
    await sleep(chunk);left-=chunk;
  }
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const random=engine=>engine&&typeof engine.rng==='function'?engine.rng():Math.random();
const rnd=(engine,a,b)=>a+random(engine)*(b-a);

const P={
  GTO_Monkey:{speed:1.00,tank:.11,timebank:.020},
  NitKing:{speed:1.18,tank:.18,timebank:.035},
  BluffDaddy:{speed:1.06,tank:.18,timebank:.050},
  CallingStation:{speed:.90,tank:.09,timebank:.018},
  MinRaiseBoss:{speed:.84,tank:.07,timebank:.015},
  RiverPolice:{speed:1.26,tank:.25,timebank:.075},
  PohuiCall:{speed:.88,tank:.08,timebank:.018},
  BubbleTerror:{speed:1.12,tank:.21,timebank:.060}
};

function plan(engine,player,legal){
  const p=P[player.nick]||{speed:1,tank:.14,timebank:.03};
  const street=engine.street||'preflop';
  const facing=Number(legal.toCall||0)>0;
  const callBB=Number(legal.toCallBB||0);
  const potBB=Number(legal.potBB||0);
  const stackBB=Number(legal.stackBB||0);
  const pressure=callBB/Math.max(1,potBB+callBB);
  let mode='normal',seconds;

  // Trivial actions really can be fast.
  if(!facing){
    if(street==='preflop')seconds=rnd(engine,1.3,3.0);
    else if(street==='flop')seconds=rnd(engine,1.7,4.1);
    else if(street==='turn')seconds=rnd(engine,2.1,5.2);
    else seconds=rnd(engine,2.8,6.6);
  }else{
    if(street==='preflop')seconds=rnd(engine,2.5,5.8);
    else if(street==='flop')seconds=rnd(engine,3.0,7.0);
    else if(street==='turn')seconds=rnd(engine,4.0,8.8);
    else seconds=rnd(engine,5.0,11.5);
  }

  // Bigger price / larger pot / shallow stack = more meaningful tournament decision.
  seconds += Math.min(3.8,callBB*.18);
  seconds += Math.min(2.0,potBB/35);
  if(pressure>.28)seconds+=rnd(engine,.8,2.2);
  if(stackBB<18&&facing)seconds+=rnd(engine,.6,1.8);
  if(street==='preflop'&&Number(legal.preflopRaiseCount||0)>=2)seconds+=rnd(engine,1.0,2.8);

  // Snap checks / trivial cheap decisions.
  if(random(engine)<.16 && (!facing || callBB<=1.5)){
    seconds=rnd(engine,1.0,2.1);mode='snap';
  }

  // Tanks are concentrated where a real player would tank more often.
  const complexity=(street==='river'?1.7:street==='turn'?1.35:1)*(facing?1.3:1)*(pressure>.25?1.25:1);
  if(random(engine)<Math.min(.38,p.tank*complexity)){
    seconds=rnd(engine,street==='river'?9.5:7.2,street==='river'?16.5:13.2)*p.speed;
    mode='tank';
  }

  // Time bank is rare and mostly river / large facing bet.
  const tbChance=p.timebank*(street==='river'?1.8:1)*(facing?1.35:.6)*(pressure>.25?1.35:1);
  if(random(engine)<Math.min(.14,tbChance)){
    seconds=rnd(engine,14,22);
    mode='timebank';
  }

  seconds=clamp(seconds*p.speed,1.0,23);
  return{seconds,ms:Math.round(seconds*1000),mode};
}

const original=HoldemDemo.prototype.botAction;
HoldemDemo.prototype.botAction=async function(player,legal){
  const x=player.__humanThinkPlan||plan(this,player,legal);
  player.__humanThinkPlan=x;
  await cancellableSleep(this,x.ms);
  if(this.destroyed)return{type:legal.canCheck?'check':'fold'};
  const old=this.botDelayMs;
  this.botDelayMs=0;
  try{return await original.call(this,player,legal)}
  finally{this.botDelayMs=old;player.__humanThinkPlan=null}
};

window.__KATALY_PACE_PLAN__=plan;
console.info('[KATALY] human pacing v3 active');
