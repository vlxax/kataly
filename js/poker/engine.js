
import { createDeck, shuffle } from './deck.js?v=130';
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
    botDelayMs=700,eventPaceMs=180,dealPaceMs=90,boardPaceMs=320,sessionSeconds=600,testMode=false,
    onChange,onHeroDecision,onHandEnd,onTournamentEnd
  }){
    this.heroNick=heroNick;
    this.baseSB=smallBlind;this.baseBB=bigBlind;
    this.sb=smallBlind;this.bb=bigBlind;this.ante=bigBlindAnte?bigBlind:0;
    this.bigBlindAnte=!!bigBlindAnte;
    this.botDelayMs=botDelayMs;
    this.eventPaceMs=eventPaceMs;
    this.dealPaceMs=dealPaceMs;
    this.boardPaceMs=boardPaceMs;
    this.testMode=!!testMode;
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
    this.handHistory=[]; // raw event stream used by diagnostics/tests
    this.destroyed=false;
    this.running=false;this.finished=false;
    this.sessionSeconds=Math.max(60,Number(sessionSeconds)||600);this.sessionStartedAt=Date.now();this.sessionEndReason=null;

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
    const event=this.bus.emit(type,{handNo:this.handNo,street:this.street,...payload});
    this.handHistory.push(event);
    if(this.handHistory.length>2500)this.handHistory.splice(0,this.handHistory.length-2000);
    return event;
  }
  destroy(){
    if(this.destroyed)return;
    this.destroyed=true;
    clearInterval(this.timer);
    this.currentActorSeat=null;this.currentActorNick=null;
    this.bus.clear();
  }
  async pause(ms){
    if(this.testMode||ms<=0)return !this.destroyed;
    let left=ms;
    while(left>0&&!this.destroyed){
      const chunk=Math.min(50,left);
      await sleep(chunk);left-=chunk;
    }
    return !this.destroyed;
  }
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
  sessionRemaining(){return Math.max(0,this.sessionSeconds-Math.floor((Date.now()-this.sessionStartedAt)/1000))}
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
  nextInHand(from){
    for(let n=1;n<=this.players.length;n++){
      const i=(from+n)%this.players.length,p=this.players[i];
      if(!p.out&&!p.folded)return i;
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
      6:['BTN','SB','BB','UTG','HJ','CO'],7:['BTN','SB','BB','UTG','MP','HJ','CO'],8:['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO'],9:['BTN','SB','BB','UTG','UTG+1','MP','LJ','HJ','CO']
    };
    const labels=map[liveCount]||map[9];
    let idx=this.button;
    for(const label of labels){
      this.players[idx].position=label;idx=this.nextLive(idx);
    }
  }

  snapshot(){
    const active=this.active();
    const avg=active.reduce((s,p)=>s+p.stack,0)/Math.max(1,active.length);
    const hero=this.hero();
    const stackOrder=active.slice().sort((a,b)=>b.stack-a.stack);
    const heroRank=hero&&!hero.out?stackOrder.findIndex(p=>p.nick===hero.nick)+1:null;
    const next=this.nextLevel()||{sb:this.sb,bb:this.bb,ante:this.ante};
    return{
      players:this.players.map(p=>({...p,hole:p.nick===this.heroNick?p.hole:['XX','XX'],stackBB:p.stack/this.bb,betBB:p.bet/this.bb})),
      heroHole:hero?hero.hole.slice():[],board:this.board.slice(),pot:this.pot,streetPot:this.streetPot,potBB:this.pot/this.bb,
      street:this.street,phase:this.phase,handNo:this.handNo,currentBet:this.currentBet,currentBetBB:this.currentBet/this.bb,button:this.button,
      log:this.log.slice(-12),sb:this.sb,bb:this.bb,ante:this.ante,level:this.level+1,
      levelRemaining:this.levelRemaining(),nextLevel:next,nextSB:next.sb,nextBB:next.bb,nextAnte:next.ante,
      activePlayers:active.length,totalPlayers:this.players.length,averageStackBB:avg/this.bb,
      heroStackBB:(hero?hero.stack:0)/this.bb,heroRank:heroRank,
      currentActorSeat:this.currentActorSeat,currentActorNick:this.currentActorNick,
      eliminations:this.eliminations.slice(),finished:this.finished,sessionRemaining:this.sessionRemaining(),sessionSeconds:this.sessionSeconds
    };
  }
  emit(){
    if(this.destroyed)return;
    if(this.onChange){
      try{this.onChange(this.snapshot())}
      catch(err){console.error('[KATALY onChange]',err)}
    }
  }

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
    if(this.destroyed||this.running||this.finished)return;
    if(this.active().length<2){this.finishTournament('last-player');return;}
    if(this.sessionRemaining()<=0){this.finishTournament('time');return;}

    this.updateLevel();this.running=true;this.handNo++;
    this.deck=shuffle(createDeck());this.board=[];this.pot=0;this.streetPot=0;this.street='preflop';this.phase='dealing';
    this.handActions=[];this.log=[];this.currentBet=0;this.lastFullRaise=this.bb;
    this.currentActorSeat=null;this.currentActorNick=null;

    this.players.forEach(p=>{
      p.bet=0;p.totalBet=0;p.folded=p.out;p.allIn=false;p.lastAction='';p.hole=[];
      p.handStartStack=p.stack;
    });
    this.assignPositions();
    this.event('HAND_STARTED',{button:this.button,players:this.players.map(p=>({seat:p.seat,nick:p.nick,position:p.position,stack:p.stack,out:p.out}))});
    this.emit();

    const live=this.active();
    const sbIndex=live.length===2?this.button:this.nextLive(this.button);
    const bbIndex=this.nextLive(sbIndex);

    if(this.bigBlindAnte&&this.ante>0){
      this.postDead(this.players[bbIndex],this.ante,'BBA');
      if(!await this.pause(this.eventPaceMs))return;
    }
    this.take(this.players[sbIndex],this.sb,'SB');
    this.event('FORCED_BET',{seat:sbIndex,nick:this.players[sbIndex].nick,label:'SB',amount:this.sb,stack:this.players[sbIndex].stack,pot:this.pot});
    this.emit();if(!await this.pause(this.eventPaceMs))return;

    this.take(this.players[bbIndex],this.bb,'BB');
    this.event('FORCED_BET',{seat:bbIndex,nick:this.players[bbIndex].nick,label:'BB',amount:this.bb,stack:this.players[bbIndex].stack,pot:this.pot});
    this.currentBet=Math.max(this.players[sbIndex].bet,this.players[bbIndex].bet);
    this.emit();if(!await this.pause(this.eventPaceMs))return;

    // true dealing order: one card around the table, then second round
    // The blind/ante can reduce a player's stack to zero. That player is still
    // in this hand and must receive two cards, even though they can no longer act.
    const handSeats=this.players.filter(p=>!p.out&&!p.folded).map(p=>p.seat);
    let start=this.nextInHand(this.button);
    for(let round=0;round<2;round++){
      let cursor=start;
      for(let n=0;n<handSeats.length;n++){
        const p=this.players[cursor];
        const card=this.deck.pop();p.hole.push(card);
        this.event('CARD_DEALT',{seat:p.seat,nick:p.nick,round,card:p.nick===this.heroNick?card:'XX'});
        this.emit();
        if(!await this.pause(this.dealPaceMs))return;
        cursor=this.nextInHand(cursor);
      }
    }

    this.phase='action';this.emit();
    if(!await this.pause(this.boardPaceMs))return;
    const preflopStart=live.length===2?sbIndex:this.nextLive(bbIndex);
    await this.bettingRound(preflopStart);

    if(this.liveInHand().length>1){
      this.street='flop';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'flop'});
      for(let i=0;i<3;i++){this.dealBoard(1);this.emit();if(!await this.pause(i<2?this.boardPaceMs:this.boardPaceMs+200))return;}
      this.phase='action';this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }
    if(this.liveInHand().length>1){
      this.street='turn';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'turn'});
      if(!await this.pause(this.boardPaceMs))return;this.dealBoard(1);this.emit();if(!await this.pause(this.boardPaceMs+300))return;
      this.phase='action';this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }
    if(this.liveInHand().length>1){
      this.street='river';this.phase='board';this.resetStreet();this.burn();
      this.event('STREET_STARTED',{street:'river'});
      if(!await this.pause(this.boardPaceMs))return;this.dealBoard(1);this.emit();if(!await this.pause(this.boardPaceMs+380))return;
      this.phase='action';this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }

    this.phase='showdown';this.event('SHOWDOWN_STARTED',{});this.emit();if(!await this.pause(this.boardPaceMs))return;
    this.finishHand();

    if(!this.finished)this.button=this.nextLive(this.button);
    this.running=false;
  }

  async bettingRound(startIndex){
    if(this.liveInHand().length<=1)return;
    let idx=startIndex,acted=new Set(),raiseRights=new Set(this.canAct().map(p=>p.seat)),guard=0;

    while(!this.destroyed&&guard++<300){
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
            if(this.destroyed){resolve({type:legal.canCheck?'check':'fold'});return}
            if(this.onHeroDecision){
              try{this.onHeroDecision(legal,resolve)}
              catch(err){
                console.error('[KATALY hero decision callback]',err);
                resolve({type:legal.canCheck?'check':'fold'});
              }
            }else resolve({type:legal.canCheck?'check':'call'});
          });
        }else{
          action=await this.botAction(p,legal);
        }
        if(this.destroyed)return;

        const decisionMs=Math.max(0,Date.now()-this.decisionStartedAt);
        const outcome=this.applyAction(p,action||{type:legal.canCheck?'check':'fold'},legal,{potBefore,decisionMs});
        raiseRights.delete(p.seat);
        if(outcome.fullRaise){
          acted=new Set([p.seat]);
          raiseRights=new Set(this.canAct().filter(x=>x.seat!==p.seat).map(x=>x.seat));
        }else acted.add(p.seat);

        this.emit();
        if(!await this.pause(this.eventPaceMs))return;
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
      if(requested<legal.minRaise||requested>legal.maxRaise)throw new Error('RAISE_OUT_OF_RANGE');
      const target=requested;
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
      amountBB:amount/this.bb,toCallBB:legal.toCallBB,currentBetBB:legal.currentBet/this.bb,
      potBeforeBB:(meta.potBefore||0)/this.bb,potAfterBB:this.pot/this.bb,
      potOdds:legal.toCall>0?legal.toCall/Math.max(1,(meta.potBefore||0)+legal.toCall):0,
      decisionMs:meta.decisionMs||0,playersInHand:this.liveInHand().length,
      effectiveStackBB:Math.min(...this.liveInHand().map(x=>x.stack+Math.max(0,this.currentBet-x.bet)))/this.bb,
      stackAfterBB:player.stack/this.bb,heroHole:this.hero()?this.hero().hole.slice():[],
      board:this.board.slice(),ts:Date.now()
    });
    return{fullRaise};
  }

  positionFactor(position){
    const map={UTG:-.09,HJ:-.04,CO:.04,BTN:.09,'BTN/SB':.08,SB:-.01,BB:.02};
    return map[position]||0;
  }

  styleProfile(player){
    const key=(player.nick+' '+(player.style||'')).toLowerCase();
    if(key.indexOf('nit')>=0)return{loose:-.13,agg:-.12,bluff:.03,call:-.10};
    if(key.indexOf('bluff')>=0||key.indexOf('агро')>=0)return{loose:.08,agg:.18,bluff:.18,call:-.02};
    if(key.indexOf('calling')>=0||key.indexOf('липк')>=0||key.indexOf('pohu')>=0)return{loose:.15,agg:-.10,bluff:.02,call:.18};
    if(key.indexOf('minraise')>=0||key.indexOf('хаот')>=0)return{loose:.12,agg:.06,bluff:.10,call:.07};
    if(key.indexOf('river')>=0||key.indexOf('дисцип')>=0)return{loose:-.04,agg:.02,bluff:.05,call:-.03};
    if(key.indexOf('bubble')>=0||key.indexOf('icm')>=0)return{loose:.03,agg:.13,bluff:.12,call:-.05};
    return{loose:0,agg:.05,bluff:.07,call:0};
  }

  postflopInfo(player){
    const cards=player.hole.concat(this.board),rank=evaluate7(cards),category=rank[0]||0;
    const holeRanks=player.hole.map(c=>RANK[c[0]]),boardRanks=this.board.map(c=>RANK[c[0]]);
    const suits={};cards.forEach(c=>suits[c[1]]=(suits[c[1]]||0)+1);
    const flushDraw=Object.keys(suits).some(k=>suits[k]===4);
    const uniq=Array.from(new Set(cards.map(c=>RANK[c[0]]))).sort((a,b)=>a-b);
    if(uniq.indexOf(14)>=0)uniq.unshift(1);
    let oesd=false,gutshot=false;
    for(let lo=1;lo<=10;lo++){
      let have=0;for(let x=lo;x<lo+5;x++)if(uniq.indexOf(x)>=0)have++;
      if(have===4){
        const missing=[];for(let x=lo;x<lo+5;x++)if(uniq.indexOf(x)<0)missing.push(x);
        if(missing.length===1&&(missing[0]===lo||missing[0]===lo+4))oesd=true;else gutshot=true;
      }
    }
    const overcards=holeRanks.filter(v=>boardRanks.length&&v>Math.max.apply(null,boardRanks)).length;
    let strength=.08+category*.115;
    if(category===1)strength+=.08;if(category>=2)strength+=.12;
    if(flushDraw)strength+=.12;if(oesd)strength+=.10;else if(gutshot)strength+=.05;
    strength+=overcards*.025;
    return{rank:rank,category:category,flushDraw:flushDraw,oesd:oesd,gutshot:gutshot,strength:Math.max(.03,Math.min(.98,strength))};
  }

  chooseRaiseTarget(legal,fraction){
    const base=this.currentBet+legal.toCall;
    const add=Math.max(this.bb,Math.round((legal.pot+legal.toCall)*fraction));
    return Math.max(legal.minRaise,Math.min(legal.maxRaise,base+add));
  }

  async botAction(player,legal){
    if(!await this.pause(this.botDelayMs+Math.random()*this.botDelayMs*.45))return{type:legal.canCheck?'check':'fold'};
    const profile=this.styleProfile(player),pos=this.positionFactor(player.position);
    const pressure=legal.toCall/Math.max(1,legal.pot+legal.toCall);
    let strength,draw=false;
    if(this.street==='preflop')strength=this.preflopStrength(player.hole)+pos+profile.loose;
    else{
      const info=this.postflopInfo(player);strength=info.strength;draw=info.flushDraw||info.oesd||info.gutshot;
    }
    strength=Math.max(0,Math.min(1,strength));
    const monster=strength>.78,good=strength>.58,medium=strength>.40;
    const bluffChance=Math.max(0,profile.bluff+(player.position==='BTN'||player.position==='CO'? .08:0));

    // Facing a bet: use pot odds, hand strength and archetype instead of auto-calling.
    if(legal.toCall>0){
      const callThreshold=Math.max(.16,pressure-profile.call);
      if(!medium&&!draw&&strength<callThreshold&&Math.random()>bluffChance)return{type:'fold'};
      if(legal.canRaise&&(monster||(good&&Math.random()<.20+profile.agg*.35))){
        if(legal.stackBB<14||monster&&legal.stackBB<24)return{type:'allin'};
        return{type:'raise',amount:this.chooseRaiseTarget(legal,this.street==='preflop'?.65:(strength>.75?.75:.55))};
      }
      if(strength+profile.call>=pressure*.90||draw)return{type:'call'};
      return Math.random()<.18+profile.call?{type:'call'}:{type:'fold'};
    }

    // Checked to: value bet strong hands, stab some weak ranges, check medium showdown value.
    if(legal.canRaise){
      let betFreq=.08+Math.max(0,profile.agg)*.45+Math.max(0,pos)*.6;
      if(monster)betFreq=.88;else if(good)betFreq=.62;else if(draw)betFreq=.48;
      else if(strength<.28)betFreq+=bluffChance;
      if(Math.random()<Math.min(.92,betFreq)){
        if(monster&&legal.stackBB<18)return{type:'allin'};
        const frac=monster?.72:(draw?.52:(strength<.30?.34:.45));
        return{type:'raise',amount:this.chooseRaiseTarget(legal,frac)};
      }
    }
    return{type:'check'};
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
      pots.push({size,eligible,participants:participants.map(x=>x.player),slice:level-prev});
    }
    return pots;
  }
  showdown(){
    const contenders=this.liveInHand();
    if(contenders.length===1){
      const winner=contenders[0];
      winner.stack+=this.pot;
      const award={amount:this.pot,winners:[winner.nick],label:'Без вскрытия'};
      this.event('POT_AWARDED',award);
      return[award];
    }

    contenders.forEach(p=>this.event('CARDS_REVEALED',{seat:p.seat,nick:p.nick,cards:p.hole.slice()}));
    const ranked=new Map();contenders.forEach(p=>ranked.set(p.nick,evaluate7(p.hole.concat(this.board))));
    const pots=this.buildSidePots(contenders);const list=pots.length?pots:[{size:this.pot,eligible:contenders,participants:contenders,slice:0}];
    const awards=[];
    for(const pot of list){
      // A contribution layer with no live contender is an unmatched wager.
      // Return it instead of silently deleting chips from the tournament.
      if(!pot.eligible.length){
        for(const p of pot.participants){p.stack+=pot.slice;this.event('UNCALLED_BET_RETURNED',{seat:p.seat,nick:p.nick,amount:pot.slice});}
        continue;
      }
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
    const busted=this.players.filter(p=>p.stack<=0&&!p.out);
    // При нескольких вылетах в одной руке большее количество фишек в начале руки
    // получает более высокое место — стандартная турнирная логика.
    busted.sort((a,b)=>(Number(b.handStartStack)||0)-(Number(a.handStartStack)||0));
    const survivors=this.players.filter(p=>p.stack>0&&!p.out).length;
    busted.forEach((p,i)=>{
      p.out=true;
      const place=survivors+1+i;
      const eliminatedBy=winnerNames.length===1?winnerNames[0]:null;
      const e={nick:p.nick,place,handNo:this.handNo,ts:Date.now(),handStartStack:p.handStartStack||0,eliminatedBy};
      this.eliminations.push(e);newlyOut.push(e);
    });
    const summary={
      handNo:this.handNo,pot:this.pot,winners:winnerNames,awards,board:this.board.slice(),
      heroHole:this.hero()?this.hero().hole.slice():[],actions:this.handActions.slice(),
      label:awards.length?awards[0].label:'',sb:this.sb,bb:this.bb,ante:this.ante,level:this.level+1,newlyOut
    };
    this.sessionHands.push(summary);
    this.event('HAND_FINISHED',{summary});
    this.emit();
    if(this.onHandEnd){
      try{this.onHandEnd(summary)}
      catch(err){console.error('[KATALY onHandEnd]',err)}
    }

    const hero=this.hero();
    if(this.active().length<=1||(hero&&hero.out))this.finishTournament(hero&&hero.out?'hero-out':'last-player');
    else if(this.sessionRemaining()<=0)this.finishTournament('time');
  }

  finishTournament(reason='complete'){
    if(this.finished)return;
    this.sessionEndReason=reason;
    this.finished=true;this.destroy();
    const active=this.active();
    if(active.length===1&&!this.eliminations.some(e=>e.nick===active[0].nick)){
      this.eliminations.push({nick:active[0].nick,place:1,handNo:this.handNo,ts:Date.now()});
    }
    const heroResult=this.eliminations.find(e=>e.nick===this.heroNick);
    const hero=this.hero();
    let heroPlace=heroResult?heroResult.place:null;
    if(heroPlace==null){
      const order=this.players.slice().sort((a,b)=>b.stack-a.stack);
      heroPlace=Math.max(1,order.findIndex(p=>p.nick===this.heroNick)+1);
    }
    if(this.onTournamentEnd)try{this.onTournamentEnd({
      heroPlace,totalPlayers:this.players.length,winner:active.length===1?active[0].nick:null,
      eliminations:this.eliminations.slice().sort((a,b)=>a.place-b.place),
      handNo:this.handNo,level:this.level+1,sb:this.sb,bb:this.bb,ante:this.ante,reason:this.sessionEndReason,sessionSeconds:this.sessionSeconds,sessionElapsed:Math.min(this.sessionSeconds,Math.floor((Date.now()-this.sessionStartedAt)/1000))
    })}catch(err){console.error('[KATALY onTournamentEnd]',err)}
  }
}
