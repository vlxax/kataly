
import { createDeck, shuffle } from './deck.js';

const RANK_VALUE = {2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};

function combos(arr,k){
  const out=[];
  function rec(start, cur){
    if(cur.length===k){out.push([...cur]);return}
    for(let i=start;i<arr.length;i++){cur.push(arr[i]);rec(i+1,cur);cur.pop()}
  }
  rec(0,[]); return out;
}
function fiveRank(cards){
  const vals=cards.map(c=>RANK_VALUE[c[0]]).sort((a,b)=>b-a);
  const suits=cards.map(c=>c[1]);
  const counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const groups=Object.entries(counts).map(([v,n])=>({v:+v,n})).sort((a,b)=>b.n-a.n||b.v-a.v);
  const uniq=[...new Set(vals)].sort((a,b)=>b-a);
  if(uniq[0]===14) uniq.push(1);
  let straightHigh=0;
  for(let i=0;i<=uniq.length-5;i++){
    if(uniq[i]-uniq[i+4]===4){straightHigh=uniq[i];break}
  }
  const flush=new Set(suits).size===1;
  if(flush && straightHigh) return [8,straightHigh];
  if(groups[0].n===4) return [7,groups[0].v,groups[1].v];
  if(groups[0].n===3 && groups[1]?.n>=2) return [6,groups[0].v,groups[1].v];
  if(flush) return [5,...vals];
  if(straightHigh) return [4,straightHigh];
  if(groups[0].n===3) return [3,groups[0].v,...groups.filter(g=>g.n===1).map(g=>g.v).sort((a,b)=>b-a)];
  if(groups[0].n===2 && groups[1]?.n===2){
    const ps=[groups[0].v,groups[1].v].sort((a,b)=>b-a);
    const kick=groups.find(g=>g.n===1)?.v||0;
    return [2,...ps,kick];
  }
  if(groups[0].n===2) return [1,groups[0].v,...groups.filter(g=>g.n===1).map(g=>g.v).sort((a,b)=>b-a)];
  return [0,...vals];
}
function cmp(a,b){
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const x=a[i]||0,y=b[i]||0;if(x!==y)return x-y;
  } return 0;
}
export function evaluate7(cards){
  let best=null;
  for(const c of combos(cards,5)){const r=fiveRank(c);if(!best||cmp(r,best)>0)best=r}
  return best;
}
export function rankLabel(r){
  return ['Старшая карта','Пара','Две пары','Сет','Стрит','Флеш','Фулл-хаус','Каре','Стрит-флеш'][r?.[0]||0];
}

export class HoldemDemo {
  constructor({players, heroNick, stackBB=100, smallBlind=1, bigBlind=2, blindSchedule=null, handsPerLevel=3, onChange, onHeroDecision, onHandEnd, onTournamentEnd}){
    this.players=players.map((p,i)=>({...p,seat:i,stack:stackBB,bet:0,totalBet:0,folded:false,out:false,hole:[]}));
    this.heroNick=heroNick; this.sb=smallBlind; this.bb=bigBlind; this.button=0;
    this.baseSB=smallBlind;this.baseBB=bigBlind;
    this.handsPerLevel=handsPerLevel||3;
    this.blindSchedule=blindSchedule||[
      {sb:1,bb:2},{sb:2,bb:4},{sb:3,bb:6},{sb:5,bb:10},{sb:8,bb:16},{sb:12,bb:24},{sb:20,bb:40}
    ];
    this.onChange=onChange;this.onHeroDecision=onHeroDecision;this.onHandEnd=onHandEnd;this.onTournamentEnd=onTournamentEnd;
    this.handNo=0;this.log=[];this.handActions=[];this.sessionHands=[];this.running=false;
    this.eliminations=[];this.finished=false;
  }
  active(){return this.players.filter(p=>!p.out && p.stack>0)}
  hero(){return this.players.find(p=>p.nick===this.heroNick)}
  levelIndex(){
    return Math.min(this.blindSchedule.length-1,Math.floor(Math.max(0,this.handNo-1)/this.handsPerLevel));
  }
  currentLevel(){return this.blindSchedule[this.levelIndex()]||{sb:this.sb,bb:this.bb}}
  applyBlindLevel(){
    const lvl=this.currentLevel();this.sb=lvl.sb;this.bb=lvl.bb;
  }
  emit(){this.onChange?.(this.snapshot())}
  snapshot(){
    return {
      players:this.players.map(p=>({...p,hole:p.nick===this.heroNick?p.hole:['XX','XX']})),
      heroHole:this.hero()?.hole||[],board:[...(this.board||[])],pot:this.pot||0,street:this.street||'waiting',
      handNo:this.handNo,currentBet:this.currentBet||0,button:this.button,log:[...this.log].slice(-6),handActions:[...this.handActions],
      sb:this.sb,bb:this.bb,level:this.levelIndex()+1,handsPerLevel:this.handsPerLevel,
      activePlayers:this.active().length,totalPlayers:this.players.length,
      eliminations:[...this.eliminations],finished:this.finished
    };
  }
  nextLive(from){
    for(let n=1;n<=this.players.length;n++){let i=(from+n)%this.players.length;if(!this.players[i].out&&this.players[i].stack>0)return i}
    return from;
  }
  post(p,amount,label){
    const a=Math.min(amount,p.stack);p.stack-=a;p.bet+=a;p.totalBet+=a;this.pot+=a;
    this.log.push(`${p.nick}: ${label} ${a} BB`);
  }
  resetBets(){this.players.forEach(p=>p.bet=0);this.currentBet=0}
  async startHand(){
    if(this.running||this.finished)return; this.running=true;
    if(this.active().length<2){this.running=false;this.finishTournament();return}
    this.handNo++;this.applyBlindLevel(); this.deck=shuffle(createDeck());this.board=[];this.pot=0;this.street='preflop';this.handActions=[];this.log=[];
    this.players.forEach(p=>{p.bet=0;p.totalBet=0;p.folded=p.out;p.hole=p.out?[]:[this.deck.pop(),this.deck.pop()]});
    const sbI=this.nextLive(this.button), bbI=this.nextLive(sbI);
    this.post(this.players[sbI],this.sb,'SB');this.post(this.players[bbI],this.bb,'BB');this.currentBet=this.bb;
    this.emit();
    await this.bettingRound(this.nextLive(bbI));
    if(this.liveInHand().length>1){this.street='flop';this.resetBets();this.deck.pop();this.board.push(this.deck.pop(),this.deck.pop(),this.deck.pop());this.emit();await this.bettingRound(this.nextLive(this.button))}
    if(this.liveInHand().length>1){this.street='turn';this.resetBets();this.deck.pop();this.board.push(this.deck.pop());this.emit();await this.bettingRound(this.nextLive(this.button))}
    if(this.liveInHand().length>1){this.street='river';this.resetBets();this.deck.pop();this.board.push(this.deck.pop());this.emit();await this.bettingRound(this.nextLive(this.button))}
    this.finishHand();this.button=this.nextLive(this.button);this.running=false;
  }
  liveInHand(){return this.players.filter(p=>!p.out&&!p.folded)}
  canAct(){return this.players.filter(p=>!p.out&&!p.folded&&p.stack>0)}
  async bettingRound(start){
    if(this.liveInHand().length<=1)return;
    let idx=start, acted=new Set(), guard=0;
    while(guard++<80){
      const p=this.players[idx];
      if(!p.out&&!p.folded&&p.stack>0){
        const toCall=Math.max(0,this.currentBet-p.bet);
        let action;
        if(p.nick===this.heroNick){
          action=await this.askHero(p,toCall);
        } else {
          action=await this.botAction(p,toCall);
        }
        const raised=this.applyAction(p,action,toCall);
        if(raised) acted=new Set([p.seat]); else acted.add(p.seat);
        this.emit();
      }
      if(this.liveInHand().length<=1)return;
      const actionable=this.canAct();
      if(actionable.length===0)return;
      const settled=actionable.every(x=>x.bet===this.currentBet && acted.has(x.seat));
      if(settled)return;
      idx=this.nextLive(idx);
      while((this.players[idx].folded||this.players[idx].out||this.players[idx].stack<=0) && idx!==start) idx=this.nextLive(idx);
    }
  }
  askHero(p,toCall){
    return new Promise(resolve=>{
      const legal={toCall,canCheck:toCall===0,minRaise:Math.max(this.bb,this.currentBet*2-p.bet),stack:p.stack,pot:this.pot};
      this.onHeroDecision?.(legal,(a)=>resolve(a));
    });
  }
  async botAction(p,toCall){
    await new Promise(r=>setTimeout(r,260));
    const strength=this.preflopStrength(p.hole);
    const pressure=toCall/Math.max(1,p.stack+toCall);
    if(toCall>0 && strength<0.28 && pressure>.05) return {type:'fold'};
    if(strength>.72 && p.stack>toCall+this.bb*3 && Math.random()<.58) return {type:'raise',amount:Math.min(p.stack+p.bet,Math.max(this.currentBet*2.4,this.bb*3))};
    if(toCall===0 && strength>.55 && Math.random()<.34) return {type:'raise',amount:Math.min(p.stack+p.bet,Math.max(this.bb*2.5,this.pot*.55))};
    return {type:toCall===0?'check':'call'};
  }
  preflopStrength(h){
    const a=RANK_VALUE[h[0][0]],b=RANK_VALUE[h[1][0]],pair=a===b,suited=h[0][1]===h[1][1];
    return Math.min(1,(a+b)/30+(pair?.25:0)+(suited?.07:0)-(Math.abs(a-b)>5?.08:0));
  }
  applyAction(p,a,toCall){
    const before=p.bet; let amount=0;
    if(a.type==='fold'){p.folded=true;this.log.push(`${p.nick}: FOLD`)}
    else if(a.type==='check'){this.log.push(`${p.nick}: CHECK`)}
    else if(a.type==='call'){
      amount=Math.min(toCall,p.stack);p.stack-=amount;p.bet+=amount;p.totalBet+=amount;this.pot+=amount;this.log.push(`${p.nick}: CALL ${amount} BB`)
    } else if(a.type==='raise'){
      const target=Math.min(p.bet+p.stack,Math.max(this.currentBet+this.bb,+a.amount||this.currentBet+this.bb));
      amount=Math.max(0,target-p.bet);p.stack-=amount;p.bet+=amount;p.totalBet+=amount;this.pot+=amount;this.currentBet=Math.max(this.currentBet,p.bet);
      this.log.push(`${p.nick}: RAISE до ${p.bet} BB`)
    }
    this.handActions.push({
      handNo:this.handNo,street:this.street,player:p.nick,seat:p.seat,
      action:a.type,amountBB:amount,toCallBB:toCall,potAfterBB:this.pot,
      potBeforeBB:Math.max(0,this.pot-amount),stackAfterBB:p.stack,
      currentBetBB:this.currentBet,heroHole:[...(this.hero()?.hole||[])],
      board:[...(this.board||[])],ts:Date.now()
    });
    return p.bet>before && p.bet>this.currentBet-before || a.type==='raise';
  }
  finishHand(){
    const live=this.liveInHand(); let winners=[];
    if(live.length===1) winners=live;
    else{
      let best=null;
      for(const p of live){
        p.showRank=evaluate7([...p.hole,...this.board]);
        if(!best||cmp(p.showRank,best)>0){best=p.showRank;winners=[p]}
        else if(cmp(p.showRank,best)===0)winners.push(p)
      }
    }
    const share=this.pot/Math.max(1,winners.length); winners.forEach(w=>w.stack+=share);

    const newlyOut=[];
    this.players.forEach(p=>{
      if(p.stack<=0 && !p.out){
        p.out=true;
        const place=this.active().length+1;
        const elimination={nick:p.nick,place,handNo:this.handNo,ts:Date.now()};
        this.eliminations.push(elimination);newlyOut.push(elimination);
      }
    });

    const summary={
      handNo:this.handNo,pot:this.pot,winners:winners.map(w=>w.nick),board:[...this.board],
      heroHole:[...(this.hero()?.hole||[])],actions:[...this.handActions],
      label:winners.length?rankLabel(winners[0].showRank):'',
      sb:this.sb,bb:this.bb,level:this.levelIndex()+1,newlyOut
    };
    this.sessionHands.push(summary);
    this.log.push(`Банк ${this.pot.toFixed(1)} → ${winners.map(w=>w.nick).join(', ')}`);
    if(newlyOut.length) this.log.push(`Вылет: ${newlyOut.map(x=>`${x.nick} · ${x.place} место`).join(', ')}`);
    this.emit();this.onHandEnd?.(summary);

    const hero=this.hero();
    if(this.active().length<=1 || hero?.out) this.finishTournament();
  }
  finishTournament(){
    if(this.finished)return;
    this.finished=true;
    const active=this.active();
    if(active.length===1 && !this.eliminations.some(e=>e.nick===active[0].nick)){
      this.eliminations.push({nick:active[0].nick,place:1,handNo:this.handNo,ts:Date.now()});
    }
    const heroElim=this.eliminations.find(e=>e.nick===this.heroNick);
    const heroPlace=heroElim?.place || (active[0]?.nick===this.heroNick?1:this.active().length+1);
    const result={
      heroPlace,
      totalPlayers:this.players.length,
      winner:active.length===1?active[0].nick:null,
      eliminations:[...this.eliminations].sort((a,b)=>a.place-b.place),
      handNo:this.handNo,
      level:this.levelIndex()+1,
      sb:this.sb,bb:this.bb
    };
    this.onTournamentEnd?.(result);
  }
}
