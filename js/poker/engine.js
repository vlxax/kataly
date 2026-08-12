
import { createDeck, shuffle } from './deck.js?v=114';
import { PokerEventBus } from './eventBus.js?v=114';

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
    this.deck=[];this.log=[];this.handActions=[];this.sessionHands=[];this.eliminations=[];this.decisionStartedAt=0;
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
    return this.bus.emit(type,{handNo:this.handNo,street:this.street,...payload});
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

  postDead(player,amount,label){
    const paid=Math.min(Math.max(0,Math.round(amount)),player.stack);
    player.stack-=paid;player.totalBet+=paid;this.pot+=paid;this.streetPot+=paid;
    if(player.stack===0)player.allIn=true;
    player.lastAction=label;
    this.log.push(`${player.nick}: ${label} ${paid}`);
    this.event('FORCED_BET',{seat:player.seat,nick:player.nick,label,amount:paid,stack:player.stack,pot:this.pot});
    this.emit();return paid;
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
      position:player.position,currentBet:this.currentBet
    };
  }

  async startHand(){
    if(this.running||this.finished)return;
    if(this.active().length<2){this.finishTournament();return;}

    this.updateLevel();this.running=true;this.handNo++;
    this.deck=shuffle(createDeck());this.board=[];this.pot=0;this.streetPot=0;this.street='preflop';this.phase='dealing';
    this.handActions=[];this.log=[];this.currentBet=0;this.lastFullRaise=this.bb;
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
    this.take(this.players[sbIndex],this.sb,'SB');
    this.event('FORCED_BET',{seat:sbIndex,nick:this.players[sbIndex].nick,label:'SB',amount:this.sb,stack:this.players[sbIndex].stack,pot:this.pot});
    this.emit();await sleep(this.eventPaceMs);

    this.take(this.players[bbIndex],this.bb,'BB');
    this.event('FORCED_BET',{seat:bbIndex,nick:this.players[bbIndex].nick,label:'BB',amount:this.bb,stack:this.players[bbIndex].stack,pot:this.pot});
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
        await sleep(90);
        cursor=this.nextLive(cursor);
      }
    }

    this.phase='action';this.emit();
    await sleep(320);
    const preflopStart=live.length===2?sbIndex:this.nextLive(bbIndex);
    await this.bettingRound(preflopStart);

    if(this.liveInHand().length>1){
      this.street='flop';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'flop'});
      this.dealBoard(3);this.emit();await sleep(420);
      this.phase='action';this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }
    if(this.liveInHand().length>1){
      this.street='turn';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'turn'});
      this.dealBoard(1);this.emit();await sleep(360);
      this.phase='action';this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }
    if(this.liveInHand().length>1){
      this.street='river';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'river'});
      this.dealBoard(1);this.emit();await sleep(360);
      this.phase='action';this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }

    this.phase='showdown';this.event('SHOWDOWN_STARTED',{});this.emit();await sleep(350);
    this.finishHand();

    if(!this.finished)this.button=this.nextLive(this.button);
    this.running=false;
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

  async botAction(player,legal){
    await sleep(this.botDelayMs+Math.random()*this.botDelayMs*.55);
    let power=this.preflopStrength(player.hole);
    if(this.street!=='preflop' && this.board.length>=3){
      const rank=evaluate7(player.hole.concat(this.board));
      const made=(rank[0]||0)/8;
      const overcards=player.hole.filter(c=>RANK[c[0]]>Math.max(...this.board.map(x=>RANK[x[0]]))).length*.04;
      const suited=player.hole[0]&&player.hole[1]&&player.hole[0][1]===player.hole[1][1]?0.03:0;
      power=Math.min(1,.12+made*.78+overcards+suited);
    }
    const pressure=legal.toCall/Math.max(1,legal.pot+legal.toCall);
    if(legal.toCall>0&&power<.28&&pressure>.18)return{type:'fold'};
    if(legal.canRaise&&power>.68&&Math.random()<.42){
      const sizing=this.street==='preflop'?Math.max(this.bb*2.2,this.currentBet+this.bb*1.2):Math.max(this.bb,legal.pot*.5);
      const target=Math.min(legal.maxRaise,Math.max(legal.minRaise,Math.round(this.currentBet+sizing)));
      return{type:'raise',amount:target};
    }
    if(legal.toCall===0&&legal.canRaise&&power>.50&&Math.random()<.30){
      const sizing=this.street==='preflop'?this.bb*2.2:Math.max(this.bb,legal.pot*.33);
      return{type:'raise',amount:Math.min(legal.maxRaise,Math.max(legal.minRaise,Math.round(sizing)))};
    }
    return{type:legal.canCheck?'check':'call'};
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
      if(eligible.length)pots.push({size,eligible});
    }
    return pots;
  }
  showdown(){
    const contenders=this.liveInHand();
    if(contenders.length===1)return[{amount:this.pot,winners:[contenders[0]],label:'Без вскрытия'}];

    contenders.forEach(p=>this.event('CARDS_REVEALED',{seat:p.seat,nick:p.nick,cards:p.hole.slice()}));
    const ranked=new Map();contenders.forEach(p=>ranked.set(p.nick,evaluate7(p.hole.concat(this.board))));
    const pots=this.buildSidePots(contenders);const list=pots.length?pots:[{size:this.pot,eligible:contenders}];
    const awards=[];
    for(const pot of list){
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
      awards.push({amount:pot.size,winners:winners.map(w=>w.nick),label:rankLabel(best)});
      this.event('POT_AWARDED',{amount:pot.size,winners:winners.map(w=>w.nick),label:rankLabel(best)});
    }
    return awards;
  }

  finishHand(){
    const awards=this.showdown(),winnerNames=[];
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
