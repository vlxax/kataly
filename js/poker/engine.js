
import { createDeck, shuffle } from './deck.js?v=200';
import { PokerEventBus } from './eventBus.js?v=200';

const RANK={2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function combinations(arr,k){
  const out=[];
  function walk(start,cur){
    if(cur.length===k){out.push(cur.slice());return;}
    for(let i=start;i<arr.length;i++){
      cur.push(arr[i]);walk(i+1,cur);cur.pop();
    }
  }
  walk(0,[]);
  return out;
}
function compareRank(a,b){
  const n=Math.max(a.length,b.length);
  for(let i=0;i<n;i++){
    const x=a[i]||0,y=b[i]||0;
    if(x!==y)return x-y;
  }
  return 0;
}
function rankFive(cards){
  const values=cards.map(c=>RANK[c[0]]).sort((a,b)=>b-a);
  const suits=cards.map(c=>c[1]);
  const counts={};values.forEach(v=>counts[v]=(counts[v]||0)+1);
  const groups=Object.keys(counts).map(v=>({v:+v,n:counts[v]}))
    .sort((a,b)=>b.n-a.n||b.v-a.v);
  const uniq=Array.from(new Set(values)).sort((a,b)=>b-a);
  if(uniq[0]===14)uniq.push(1);
  let straightHigh=0;
  for(let i=0;i<=uniq.length-5;i++){
    if(uniq[i]-uniq[i+4]===4){straightHigh=uniq[i];break;}
  }
  const flush=new Set(suits).size===1;
  if(flush&&straightHigh)return[8,straightHigh];
  if(groups[0].n===4)return[7,groups[0].v,groups[1].v];
  if(groups[0].n===3&&groups[1]&&groups[1].n>=2)return[6,groups[0].v,groups[1].v];
  if(flush)return[5].concat(values);
  if(straightHigh)return[4,straightHigh];
  if(groups[0].n===3)return[3,groups[0].v].concat(groups.filter(g=>g.n===1).map(g=>g.v).sort((a,b)=>b-a));
  if(groups[0].n===2&&groups[1]&&groups[1].n===2){
    const pairs=[groups[0].v,groups[1].v].sort((a,b)=>b-a);
    const k=groups.find(g=>g.n===1);
    return[2,pairs[0],pairs[1],k?k.v:0];
  }
  if(groups[0].n===2)return[1,groups[0].v].concat(groups.filter(g=>g.n===1).map(g=>g.v).sort((a,b)=>b-a));
  return[0].concat(values);
}
export function evaluate7(cards){
  let best=null;
  for(const combo of combinations(cards,5)){
    const r=rankFive(combo);
    if(!best||compareRank(r,best)>0)best=r;
  }
  return best;
}
export function rankLabel(rank){
  return ['Старшая карта','Пара','Две пары','Сет','Стрит','Флеш','Фулл-хаус','Каре','Стрит-флеш'][(rank&&rank[0])||0];
}

export class HoldemDemo {
  constructor({
    players,heroNick,stackBB=100,smallBlind=50,bigBlind=100,
    blindSchedule=null,levelSeconds=300,bigBlindAnte=true,
    botDelayMs=700,eventPaceMs=180,onChange,onHeroDecision,onHandEnd,onTournamentEnd
  }){
    this.heroNick=heroNick;
    this.baseSB=smallBlind;this.baseBB=bigBlind;
    this.sb=smallBlind;this.bb=bigBlind;this.ante=bigBlindAnte?bigBlind:0;
    this.bigBlindAnte=!!bigBlindAnte;
    this.botDelayMs=botDelayMs;
    this.eventPaceMs=eventPaceMs;
    this.bus=new PokerEventBus();

    const startingStack=Math.round(stackBB*bigBlind);
    this.players=players.map((p,i)=>({
      nick:p.nick,type:p.type||'bot',style:p.style||'',seat:i,
      stack:startingStack,bet:0,totalBet:0,folded:false,out:false,allIn:false,
      hole:[],position:'',lastAction:''
    }));

    this.blindSchedule=blindSchedule||[
      {sb:50,bb:100,ante:100},{sb:75,bb:150,ante:150},{sb:100,bb:200,ante:200},
      {sb:150,bb:300,ante:300},{sb:200,bb:400,ante:400},{sb:300,bb:600,ante:600},
      {sb:400,bb:800,ante:800},{sb:500,bb:1000,ante:1000}
    ];
    this.levelSeconds=levelSeconds;
    this.levelStartedAt=Date.now();this.level=0;
    this.button=0;this.handNo=0;this.pot=0;this.streetPot=0;this.board=[];this.street='waiting';
    this.phase='waiting';this.currentBet=0;this.lastFullRaise=bigBlind;
    this.currentActorSeat=null;this.currentActorNick=null;
    this.runoutAnnounced=false;
    this.handStartChipTotal=this.players.reduce((sum,p)=>sum+p.stack,0);
    this.deck=[];this.log=[];this.handActions=[];this.handHistory=[];this.sessionHands=[];this.eliminations=[];this.decisionStartedAt=0;
    this.running=false;this.finished=false;

    this.onChange=onChange;this.onHeroDecision=onHeroDecision;
    this.onHandEnd=onHandEnd;this.onTournamentEnd=onTournamentEnd;

    this.timer=setInterval(()=>{
      if(this.finished)return;
      if(!this.running)this.updateLevel();
      this.emit();
    },1000);
  }

  on(type,fn){return this.bus.on(type,fn)}
  event(type,payload={}){
    const eventPayload={handNo:this.handNo,street:this.street,...payload};
    if(this.handHistory)this.handHistory.push({type,...eventPayload,at:Date.now()});
    return this.bus.emit(type,eventPayload);
  }
  destroy(){clearInterval(this.timer);this.bus.clear()}
  hero(){return this.players.find(p=>p.nick===this.heroNick)}
  active(){return this.players.filter(p=>!p.out&&p.stack>0)}
  liveInHand(){return this.players.filter(p=>!p.out&&!p.folded)}
  canAct(){return this.players.filter(p=>!p.out&&!p.folded&&!p.allIn&&p.stack>0)}

  updateLevel(){
    const elapsed=Math.floor((Date.now()-this.levelStartedAt)/1000);
    const target=Math.min(this.blindSchedule.length-1,Math.floor(elapsed/this.levelSeconds));
    if(target!==this.level){
      this.level=target;const x=this.blindSchedule[target];
      this.sb=x.sb;this.bb=x.bb;this.ante=x.ante!=null?x.ante:x.bb;
      this.lastFullRaise=this.bb;
      this.event('LEVEL_CHANGED',{level:this.level+1,sb:this.sb,bb:this.bb,ante:this.ante});
    }
  }
  levelRemaining(){
    const elapsed=Math.floor((Date.now()-this.levelStartedAt)/1000);
    return Math.max(0,this.levelSeconds-(elapsed%this.levelSeconds));
  }
  nextLevel(){return this.blindSchedule[Math.min(this.level+1,this.blindSchedule.length-1)]}
  nextLive(from){
    for(let n=1;n<=this.players.length;n++){
      const i=(from+n)%this.players.length,p=this.players[i];
      if(!p.out&&p.stack>0)return i;
    }
    return from;
  }
  firstPostflopActor(){return this.nextLive(this.button)}

  assignPositions(){
    this.players.forEach(p=>p.position='');
    const liveCount=this.active().length;if(!liveCount)return;
    if(liveCount===2){
      this.players[this.button].position='BTN/SB';
      this.players[this.nextLive(this.button)].position='BB';return;
    }
    const map={
      3:['BTN','SB','BB'],4:['BTN','SB','BB','CO'],5:['BTN','SB','BB','UTG','CO'],
      6:['BTN','SB','BB','UTG','HJ','CO']
    };
    const labels=map[liveCount]||map[6];
    let idx=this.button;
    for(const label of labels){
      this.players[idx].position=label;idx=this.nextLive(idx);
    }
  }

  snapshot(){
    const active=this.active();
    const avg=active.reduce((s,p)=>s+p.stack,0)/Math.max(1,active.length);
    const hero=this.hero();
    return{
      players:this.players.map(p=>({...p,hole:p.nick===this.heroNick?p.hole:['XX','XX'],stackBB:p.stack/this.bb,betBB:p.bet/this.bb})),
      heroHole:hero?hero.hole.slice():[],board:this.board.slice(),pot:this.pot,streetPot:this.streetPot,potBB:this.pot/this.bb,
      street:this.street,phase:this.phase,handNo:this.handNo,currentBet:this.currentBet,button:this.button,
      log:this.log.slice(-12),sb:this.sb,bb:this.bb,ante:this.ante,level:this.level+1,
      levelRemaining:this.levelRemaining(),nextLevel:this.nextLevel(),activePlayers:active.length,
      totalPlayers:this.players.length,averageStackBB:avg/this.bb,heroStackBB:(hero?hero.stack:0)/this.bb,
      currentActorSeat:this.currentActorSeat,currentActorNick:this.currentActorNick,
      eliminations:this.eliminations.slice(),finished:this.finished
    };
  }
  emit(){if(this.onChange)this.onChange(this.snapshot())}

  postDead(player,amount,label='ANTE'){
    const paid=Math.min(player.stack,Math.max(0,Math.round(amount)));
    player.stack-=paid;
    player.totalBet+=paid;
    this.pot+=paid;
    if(player.stack===0)player.allIn=true;
    this.event('FORCED_BET',{seat:player.seat,nick:player.nick,label,amount:paid,bet:player.bet,stack:player.stack,pot:this.pot,dead:true});
    return paid;
  }
  take(player,amount,label){
    const paid=Math.min(Math.max(0,Math.round(amount)),player.stack);
    player.stack-=paid;player.bet+=paid;player.totalBet+=paid;this.pot+=paid;this.streetPot+=paid;
    if(player.stack===0)player.allIn=true;
    if(label)player.lastAction=label;
    return paid;
  }
  resetStreet(){
    this.players.forEach(p=>{p.bet=0;p.lastAction=''});
    this.streetPot=0;
    this.currentBet=0;this.lastFullRaise=this.bb;
  }
  pace(ms){return sleep(this.eventPaceMs===0?0:ms)}
  burn(){if(this.deck.length)this.deck.pop()}
  dealBoard(count){
    for(let i=0;i<count;i++){
      if(!this.deck.length)throw new Error('DECK_EMPTY');
      const card=this.deck.pop();this.board.push(card);
      this.event('BOARD_CARD_DEALT',{card,index:this.board.length-1,board:this.board.slice()});
    }
  }
  legalFor(player,raiseAllowed=true){
    const toCall=Math.max(0,this.currentBet-player.bet);
    const maxTarget=player.bet+player.stack;
    const minTarget=this.currentBet===0?this.bb:this.currentBet+this.lastFullRaise;
    return{
      toCall,canCheck:toCall===0,canRaise:raiseAllowed&&maxTarget>this.currentBet,
      minRaise:Math.min(maxTarget,minTarget),maxRaise:maxTarget,stack:player.stack,pot:this.pot,
      bb:this.bb,stackBB:player.stack/this.bb,potBB:this.pot/this.bb,toCallBB:toCall/this.bb,
      position:player.position,currentBet:this.currentBet,
      currentBetBB:this.currentBet/this.bb,
      minRaiseBB:Math.min(maxTarget,minTarget)/this.bb,
      maxRaiseBB:maxTarget/this.bb
    };
  }

  async startHand(){
    if(this.running||this.finished)return;
    if(this.active().length<2){this.finishTournament();return;}

    this.updateLevel();this.running=true;this.handNo++;
    this.deck=shuffle(createDeck());this.board=[];this.pot=0;this.streetPot=0;this.street='preflop';this.phase='dealing';
    this.handActions=[];this.handHistory=[];this.log=[];this.currentBet=0;this.lastFullRaise=this.bb;
    this.lastAggressorNick=null;this.lastAggressionStreet=null;
    this.currentActorSeat=null;this.currentActorNick=null;

    this.players.forEach(p=>{
      p.bet=0;p.totalBet=0;p.folded=p.out;p.allIn=false;p.lastAction='';p.hole=[];
    });
    this.assignPositions();
    this.event('HAND_STARTED',{button:this.button,players:this.players.map(p=>({seat:p.seat,nick:p.nick,position:p.position,stack:p.stack,out:p.out}))});
    this.emit();

    const live=this.active();
    const sbIndex=live.length===2?this.button:this.nextLive(this.button);
    const bbIndex=this.nextLive(sbIndex);

    if(this.bigBlindAnte&&this.ante>0){
      this.postDead(this.players[bbIndex],this.ante,'BBA');
      await sleep(this.eventPaceMs);
    }
    const sbPaid=this.take(this.players[sbIndex],this.sb,'SB');
    this.event('FORCED_BET',{seat:sbIndex,nick:this.players[sbIndex].nick,label:'SB',amount:sbPaid,bet:this.players[sbIndex].bet,stack:this.players[sbIndex].stack,pot:this.pot});
    this.emit();await sleep(this.eventPaceMs);

    const bbPaid=this.take(this.players[bbIndex],this.bb,'BB');
    this.event('FORCED_BET',{seat:bbIndex,nick:this.players[bbIndex].nick,label:'BB',amount:bbPaid,bet:this.players[bbIndex].bet,stack:this.players[bbIndex].stack,pot:this.pot});
    this.currentBet=Math.max(this.players[sbIndex].bet,this.players[bbIndex].bet);
    this.emit();await sleep(this.eventPaceMs);

    // true dealing order: one card around the table, then second round
    let start=this.nextLive(this.button);
    for(let round=0;round<2;round++){
      let cursor=start;
      for(let n=0;n<live.length;n++){
        const p=this.players[cursor];
        const card=this.deck.pop();p.hole.push(card);
        this.event('CARD_DEALT',{seat:p.seat,nick:p.nick,round,card:p.nick===this.heroNick?card:'XX'});
        this.emit();
        await this.pace(360);
        cursor=this.nextLive(cursor);
      }
    }

    this.phase='action';this.emit();
    await this.pace(900);
    const preflopStart=live.length===2?sbIndex:this.nextLive(bbIndex);
    await this.bettingRound(preflopStart);

    if(this.liveInHand().length>1){
      if(this.bettingIsLocked()&&!this.runoutAnnounced){
        this.runoutAnnounced=true;
        this.event('ALLIN_RUNOUT',{players:this.liveInHand().map(p=>p.nick)});
        this.emit();await this.pace(700);
      }
      this.street='flop';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'flop'});
      this.dealBoard(3);this.emit();await this.pace(1100);
      this.phase='action';this.emit();
      if(!this.bettingIsLocked())await this.bettingRound(this.firstPostflopActor());
    }
    if(this.liveInHand().length>1){
      if(this.bettingIsLocked()&&!this.runoutAnnounced){
        this.runoutAnnounced=true;
        this.event('ALLIN_RUNOUT',{players:this.liveInHand().map(p=>p.nick)});
        this.emit();await this.pace(700);
      }
      this.street='turn';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'turn'});
      this.dealBoard(1);this.emit();await this.pace(950);
      this.phase='action';this.emit();
      if(!this.bettingIsLocked())await this.bettingRound(this.firstPostflopActor());
    }
    if(this.liveInHand().length>1){
      if(this.bettingIsLocked()&&!this.runoutAnnounced){
        this.runoutAnnounced=true;
        this.event('ALLIN_RUNOUT',{players:this.liveInHand().map(p=>p.nick)});
        this.emit();await this.pace(700);
      }
      this.street='river';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'river'});
      this.dealBoard(1);this.emit();await this.pace(950);
      this.phase='action';this.emit();
      if(!this.bettingIsLocked())await this.bettingRound(this.firstPostflopActor());
    }

    this.phase='showdown';this.event('SHOWDOWN_STARTED',{});this.emit();await this.pace(1200);
    this.finishHand();

    if(!this.finished)this.button=this.nextLive(this.button);
    this.running=false;
  }

  bettingIsLocked(){
    const actionable=this.canAct();
    if(actionable.length===0)return true;
    if(actionable.length===1)return actionable[0].bet>=this.currentBet;
    return false;
  }

  async bettingRound(startIndex){
    if(this.liveInHand().length<=1)return;
    let idx=startIndex,acted=new Set(),raiseRights=new Set(this.canAct().map(p=>p.seat)),guard=0;

    while(guard++<300){
      const actionableNow=this.canAct();
      if(actionableNow.length===0||(actionableNow.length===1&&actionableNow[0].bet>=this.currentBet))break;
      const p=this.players[idx];
      if(!p.out&&!p.folded&&!p.allIn&&p.stack>0){
        this.currentActorSeat=p.seat;this.currentActorNick=p.nick;
        this.event('TURN_STARTED',{seat:p.seat,nick:p.nick,position:p.position});
        this.emit();

        const legal=this.legalFor(p,raiseRights.has(p.seat));
        const potBefore=this.pot;
        this.decisionStartedAt=Date.now();
        let action;
        if(p.nick===this.heroNick){
          action=await new Promise(resolve=>{
            if(this.onHeroDecision)this.onHeroDecision(legal,resolve);
            else resolve({type:legal.canCheck?'check':'call'});
          });
        }else{
          action=await this.botAction(p,legal);
        }

        const decisionMs=Math.max(0,Date.now()-this.decisionStartedAt);
        const outcome=this.applyAction(p,action||{type:legal.canCheck?'check':'fold'},legal,{potBefore,decisionMs});
        raiseRights.delete(p.seat);
        if(outcome.fullRaise){
          acted=new Set([p.seat]);
          raiseRights=new Set(this.canAct().filter(x=>x.seat!==p.seat).map(x=>x.seat));
        }else acted.add(p.seat);

        this.emit();
        await sleep(this.eventPaceMs);
      }

      if(this.liveInHand().length<=1)break;
      const actionable=this.canAct();
      if(actionable.length===0)break;
      if(actionable.length===1&&actionable[0].bet>=this.currentBet)break;
      const closed=actionable.every(p=>p.bet===this.currentBet&&acted.has(p.seat));
      if(closed)break;
      idx=this.nextLive(idx);
    }

    this.currentActorSeat=null;this.currentActorNick=null;
    const collected=this.players.reduce((s,p)=>s+p.bet,0);
    this.event('BETTING_ROUND_COMPLETE',{street:this.street,pot:this.pot,collected});
    this.emit();
  }

  applyAction(player,action,legal,meta={}){
    const type=action.type;let amount=0,fullRaise=false;
    if(type==='fold'){
      player.folded=true;player.lastAction='FOLD';
      this.event('PLAYER_FOLDED',{seat:player.seat,nick:player.nick,stack:player.stack});
    }else if(type==='check'){
      if(!legal.canCheck)throw new Error('ILLEGAL_CHECK');
      player.lastAction='CHECK';
      this.event('PLAYER_CHECKED',{seat:player.seat,nick:player.nick,stack:player.stack});
    }else if(type==='call'){
      amount=this.take(player,legal.toCall,'CALL');
      this.event('PLAYER_CALLED',{seat:player.seat,nick:player.nick,amount,bet:player.bet,stack:player.stack,pot:this.pot});
    }else if(type==='allin'){
      const old=this.currentBet;
      amount=this.take(player,player.stack,'ALL-IN');
      if(player.bet>old){
        this.lastAggressorNick=player.nick;this.lastAggressionStreet=this.street;
        const size=player.bet-old;
        if(size>=this.lastFullRaise){this.lastFullRaise=size;fullRaise=true;}
        this.currentBet=player.bet;
      }
      this.event('PLAYER_ALLIN',{seat:player.seat,nick:player.nick,amount,bet:player.bet,stack:player.stack,pot:this.pot});
    }else if(type==='raise'){
      if(!legal.canRaise)throw new Error('ILLEGAL_RAISE');
      const requested=Math.round(Number(action.amount));
      if(!Number.isFinite(requested))throw new Error('INVALID_RAISE_AMOUNT');
      const target=Math.max(legal.minRaise,Math.min(legal.maxRaise,requested));
      const old=this.currentBet;
      amount=this.take(player,target-player.bet,'RAISE');
      if(player.bet>old){
        this.lastAggressorNick=player.nick;this.lastAggressionStreet=this.street;
        const size=player.bet-old;
        if(size>=this.lastFullRaise){this.lastFullRaise=size;fullRaise=true;}
        this.currentBet=player.bet;
      }
      this.event('PLAYER_RAISED',{seat:player.seat,nick:player.nick,amount,bet:player.bet,stack:player.stack,pot:this.pot});
    }else throw new Error('UNKNOWN_ACTION_'+type);

    this.handActions.push({
      handNo:this.handNo,street:this.street,player:player.nick,position:player.position,action:type,
      amountBB:amount/this.bb,toCallBB:legal.toCallBB,potBeforeBB:(meta.potBefore||0)/this.bb,potAfterBB:this.pot/this.bb,
      decisionMs:meta.decisionMs||0,playersInHand:this.liveInHand().length,
      effectiveStackBB:Math.min(...this.liveInHand().map(x=>x.stack+Math.max(0,this.currentBet-x.bet)))/this.bb,
      stackAfterBB:player.stack/this.bb,heroHole:this.hero()?this.hero().hole.slice():[],
      board:this.board.slice(),ts:Date.now()
    });
    return{fullRaise};
  }

  handCode(hole){
    if(!hole||hole.length<2)return'';
    const order='23456789TJQKA';
    const a=hole[0][0],b=hole[1][0];
    const hi=order.indexOf(a)>=order.indexOf(b)?a:b;
    const lo=hi===a?b:a;
    if(hi===lo)return hi+lo;
    return hi+lo+(hole[0][1]===hole[1][1]?'s':'o');
  }

  preflopOpenScore(player){
    const base={UTG:.74,HJ:.68,CO:.58,BTN:.49,SB:.55,BB:.62}[player.position]??.62;
    return base;
  }

  preflopProfile(player){
    const bots=this.players.filter(x=>x.nick!==this.heroNick);
    const i=Math.max(0,bots.findIndex(x=>x.seat===player.seat));
    return [
      {name:'NIT',openAdj:.08,threeBetAdj:.08,callAdj:.05,aggr:.40},
      {name:'REG',openAdj:0,threeBetAdj:0,callAdj:0,aggr:.52},
      {name:'LAG',openAdj:-.10,threeBetAdj:-.09,callAdj:-.03,aggr:.70},
      {name:'CALLER',openAdj:-.03,threeBetAdj:.13,callAdj:-.13,aggr:.27},
      {name:'SOLID',openAdj:.02,threeBetAdj:.02,callAdj:.02,aggr:.48}
    ][i%5];
  }

  preflopDecision(player,legal,power){
    const profile=this.preflopProfile(player);
    const unopened=this.currentBet<=this.bb;
    const facingRaise=this.currentBet>this.bb;
    const threshold=this.preflopOpenScore(player)+profile.openAdj;
    const strong3bet=.76+profile.threeBetAdj;
    const callFloor=Math.max(.32,threshold-.14+profile.callAdj);

    if(unopened){
      if(legal.canRaise&&power>=threshold){
        const target=Math.min(legal.maxRaise,Math.max(legal.minRaise,Math.round(this.bb*(player.position==='SB'?3:2.2))));
        return{type:'raise',amount:target};
      }
      if(legal.canCheck)return{type:'check'};
      return power>=callFloor?{type:'call'}:{type:'fold'};
    }

    if(facingRaise){
      if(legal.canRaise&&power>=strong3bet){
        const multiplier=player.position==='SB'||player.position==='BB'?3.6:3.1;
        const target=Math.min(legal.maxRaise,Math.max(legal.minRaise,Math.round(this.currentBet*multiplier)));
        return{type:'raise',amount:target};
      }
      if(power>=callFloor&&legal.toCallBB<=Math.max(12,legal.stackBB*.22))return{type:'call'};
      return legal.canCheck?{type:'check'}:{type:'fold'};
    }
    return null;
  }

  postflopFeatures(player){
    const cards=(player.hole||[]).concat(this.board||[]);
    const rank=cards.length>=5?evaluate7(cards):[0];
    const hole=player.hole||[];
    const board=this.board||[];
    const boardRanks=board.map(c=>RANK[c[0]]);
    const holeRanks=hole.map(c=>RANK[c[0]]);
    const maxBoard=boardRanks.length?Math.max(...boardRanks):0;

    const madeCategory=rank[0]||0;
    const pairOnHole=holeRanks.some(r=>boardRanks.includes(r));
    const overpair=holeRanks.length===2&&holeRanks[0]===holeRanks[1]&&holeRanks[0]>maxBoard;
    const topPair=holeRanks.some(r=>r===maxBoard);
    const overcards=holeRanks.filter(r=>r>maxBoard).length;

    const suitCounts={};
    cards.forEach(c=>suitCounts[c[1]]=(suitCounts[c[1]]||0)+1);
    const flushDraw=Object.values(suitCounts).some(n=>n===4);

    const uniq=[...new Set(cards.map(c=>RANK[c[0]]))].sort((a,b)=>a-b);
    if(uniq.includes(14))uniq.unshift(1);
    let straightDraw=false;
    for(let i=0;i<uniq.length;i++){
      const window=uniq.filter(x=>x>=uniq[i]&&x<=uniq[i]+4);
      if(new Set(window).size>=4){straightDraw=true;break;}
    }

    const pairedBoard=new Set(boardRanks).size<boardRanks.length;
    const monotone=board.length>=3&&new Set(board.map(c=>c[1])).size===1;
    const connected=boardRanks.length>=3&&(Math.max(...boardRanks)-Math.min(...boardRanks)<=5);

    let strength=.08;
    if(madeCategory>=5)strength=.93;
    else if(madeCategory===4)strength=.88;
    else if(madeCategory===3)strength=.78;
    else if(madeCategory===2)strength=.67;
    else if(overpair)strength=.62;
    else if(topPair)strength=.56;
    else if(pairOnHole)strength=.43;
    else strength=.16+overcards*.05;

    if(flushDraw)strength+=.10;
    if(straightDraw)strength+=.08;
    strength=Math.max(.02,Math.min(.99,strength));

    return{
      rank,madeCategory,pairOnHole,overpair,topPair,overcards,
      flushDraw,straightDraw,pairedBoard,monotone,connected,strength
    };
  }

  inPosition(player){
    const order={BTN:6,CO:5,HJ:4,UTG:3,'BTN/SB':2,SB:1,BB:0};
    const live=this.liveInHand().filter(p=>!p.folded);
    if(!live.length)return false;
    return (order[player.position]??0)>=Math.max(...live.map(p=>order[p.position]??0));
  }

  postflopDecision(player,legal){
    const f=this.postflopFeatures(player);
    const profile=this.preflopProfile(player);
    const ip=this.inPosition(player);
    const potOdds=legal.toCall/Math.max(1,legal.pot+legal.toCall);
    const spr=player.stack/Math.max(1,legal.pot);
    const facingBet=legal.toCall>0;
    const wasAggressor=this.lastAggressorNick===player.nick;
    const draw=f.flushDraw||f.straightDraw;
    const wet=f.monotone||f.connected;
    const adjusted=Math.max(0,Math.min(1,f.strength+(profile.aggr-.5)*.10+(ip?.035:0)));

    // Facing a bet: use hand strength + pot odds + draws rather than raw hole-card power.
    if(facingBet){
      if(legal.canRaise && adjusted>.82 && spr>0.7){
        const mult=wet?3.0:2.6;
        const target=Math.min(legal.maxRaise,Math.max(legal.minRaise,Math.round(this.currentBet*mult)));
        return{type:'raise',amount:target};
      }
      if(draw && potOdds<=.34)return{type:'call'};
      if(adjusted>=Math.max(.36,potOdds+.12))return{type:'call'};
      if(legal.canRaise && adjusted>.58 && profile.aggr>.62 && ip && Math.random()<.18){
        const target=Math.min(legal.maxRaise,Math.max(legal.minRaise,Math.round(this.currentBet*2.7)));
        return{type:'raise',amount:target};
      }
      return{type:'fold'};
    }

    // Checked to: c-bet/value/probe depending on profile, texture and position.
    if(legal.canRaise){
      let betFreq=.10+(profile.aggr*.34)+(ip?.08:0);
      if(wasAggressor&&this.street==='flop')betFreq+=.18;
      if(wet&&adjusted<.50)betFreq-=.08;
      if(adjusted>.72)betFreq=.86;
      if(draw&&profile.aggr>.5)betFreq+=.10;

      if(Math.random()<Math.max(.05,Math.min(.92,betFreq))){
        let frac=.33;
        if(adjusted>.78)frac=wet?.70:.55;
        else if(draw)frac=wet?.55:.40;
        else if(wet)frac=.50;
        const target=Math.min(legal.maxRaise,Math.max(legal.minRaise,Math.round(legal.pot*frac)));
        return{type:'raise',amount:target};
      }
    }
    return{type:'check'};
  }

  async botAction(player,legal){
    const dramatic=(legal.toCallBB>=8 || (legal.potBB&&legal.toCallBB/legal.potBB>.65));
    const base=this.botDelayMs===0?0:(dramatic?1500:650);
    const jitter=this.botDelayMs===0?0:Math.floor(Math.random()*(dramatic?1900:1200));
    await sleep(base+jitter);

    const power=this.preflopStrength(player.hole);
    if(this.street==='preflop'){
      const modeled=this.preflopDecision(player,legal,power);
      if(modeled)return modeled;
    }
    return this.postflopDecision(player,legal);
  }

  preflopStrength(hole){
    if(!hole||hole.length<2)return.5;
    const a=RANK[hole[0][0]],b=RANK[hole[1][0]],pair=a===b,suited=hole[0][1]===hole[1][1],gap=Math.abs(a-b);
    let v=(a+b)/30;if(pair)v+=.25;if(suited)v+=.07;if(gap>5)v-=.08;
    return Math.max(0,Math.min(1,v));
  }

  buildSidePots(contenders){
    const contributors=this.players.filter(p=>p.totalBet>0).map(p=>({player:p,amount:p.totalBet}));
    const levels=Array.from(new Set(contributors.map(x=>x.amount))).sort((a,b)=>a-b);
    const pots=[];let prev=0;
    for(const level of levels){
      const participants=contributors.filter(x=>x.amount>=level);
      const size=(level-prev)*participants.length;prev=level;
      if(size<=0)continue;
      const eligible=participants.map(x=>x.player).filter(p=>contenders.includes(p));
      if(eligible.length){
        pots.push({size,eligible});
      }else if(pots.length){
        // Dead unmatched upper layer: chips cannot disappear.
        pots[pots.length-1].size+=size;
      }else{
        throw new Error('POT_WITHOUT_ELIGIBLE_PLAYER');
      }
    }
    return pots;
  }
  showdown(){
    const contenders=this.liveInHand();
    if(contenders.length===1){
      const winner=contenders[0];
      const amount=this.pot;
      winner.stack+=amount;
      const award={amount,winners:[winner.nick],label:'Без вскрытия',potLabel:'POT',share:amount,bb:this.bb};
      this.event('POT_AWARDED',award);
      return[award];
    }

    contenders.forEach(p=>this.event('CARDS_REVEALED',{seat:p.seat,nick:p.nick,cards:p.hole.slice()}));
    const ranked=new Map();contenders.forEach(p=>ranked.set(p.nick,evaluate7(p.hole.concat(this.board))));
    const pots=this.buildSidePots(contenders);const list=pots.length?pots:[{size:this.pot,eligible:contenders}];
    const awards=[];
    for(let potIndex=0;potIndex<list.length;potIndex++){
      const pot=list[potIndex];
      let best=null,winners=[];
      for(const p of pot.eligible){
        const r=ranked.get(p.nick);
        if(!best||compareRank(r,best)>0){best=r;winners=[p]}
        else if(compareRank(r,best)===0)winners.push(p);
      }
      if(!winners.length)continue;
      const share=Math.floor(pot.size/winners.length);let remainder=pot.size-share*winners.length;
      winners.forEach(w=>w.stack+=share);
      let cursor=this.button;
      while(remainder>0){
        cursor=this.nextLive(cursor);
        const w=winners.find(x=>x.seat===cursor);
        if(w){w.stack++;remainder--;}
      }
      const potLabel=potIndex===0?'MAIN POT':`SIDE POT ${potIndex}`;
      awards.push({amount:pot.size,winners:winners.map(w=>w.nick),label:rankLabel(best),potLabel});
      this.event('POT_AWARDED',{amount:pot.size,winners:winners.map(w=>w.nick),label:rankLabel(best),potLabel,share,bb:this.bb});
    }
    return awards;
  }

  chipTotal(){
    return this.players.reduce((sum,p)=>sum+p.stack,0)+this.pot;
  }

  assertChipConservation(expected){
    const actual=this.players.reduce((sum,p)=>sum+p.stack,0);
    if(actual!==expected)throw new Error(`CHIP_CONSERVATION_FAILED expected=${expected} actual=${actual}`);
  }

  finishHand(){
    const awards=this.showdown(),winnerNames=[];
    this.assertChipConservation(this.handStartChipTotal);
    awards.forEach(a=>a.winners.forEach(n=>{if(!winnerNames.includes(n))winnerNames.push(n)}));
    const newlyOut=[];
    this.players.forEach(p=>{
      if(p.stack<=0&&!p.out){
        p.out=true;const place=this.active().length+1;
        const e={nick:p.nick,place,handNo:this.handNo,ts:Date.now()};
        this.eliminations.push(e);newlyOut.push(e);
      }
    });
    const summary={
      handNo:this.handNo,pot:this.pot,winners:winnerNames,awards,board:this.board.slice(),
      heroHole:this.hero()?this.hero().hole.slice():[],actions:this.handActions.slice(),
      label:awards.length?awards[0].label:'',sb:this.sb,bb:this.bb,ante:this.ante,level:this.level+1,newlyOut
    };
    this.sessionHands.push(summary);
    this.event('HAND_FINISHED',{summary});
    this.emit();if(this.onHandEnd)this.onHandEnd(summary);

    const hero=this.hero();
    if(this.active().length<=1||(hero&&hero.out))this.finishTournament();
  }

  _testSetState({players,currentBet=0,lastFullRaise=null,street='preflop',pot=null}){
    this.players=players.map((p,i)=>({
      seat:p.seat??i,nick:p.nick||`P${i}`,stack:p.stack??0,bet:p.bet??0,totalBet:p.totalBet??p.bet??0,
      folded:!!p.folded,out:!!p.out,allIn:!!p.allIn,hole:p.hole||[],position:p.position||'',lastAction:''
    }));
    this.currentBet=currentBet;
    this.lastFullRaise=lastFullRaise==null?this.bb:lastFullRaise;
    this.street=street;
    this.pot=pot==null?this.players.reduce((s,p)=>s+p.totalBet,0):pot;
    return this;
  }

  finishTournament(){
    if(this.finished)return;
    this.finished=true;this.destroy();
    const active=this.active();
    if(active.length===1&&!this.eliminations.some(e=>e.nick===active[0].nick)){
      this.eliminations.push({nick:active[0].nick,place:1,handNo:this.handNo,ts:Date.now()});
    }
    const heroResult=this.eliminations.find(e=>e.nick===this.heroNick);
    const heroPlace=heroResult?heroResult.place:(active.length===1&&active[0].nick===this.heroNick?1:Math.max(1,active.length));
    if(this.onTournamentEnd)this.onTournamentEnd({
      heroPlace,totalPlayers:this.players.length,winner:active.length===1?active[0].nick:null,
      eliminations:this.eliminations.slice().sort((a,b)=>a.place-b.place),
      handNo:this.handNo,level:this.level+1,sb:this.sb,bb:this.bb,ante:this.ante
    });
  }
}
