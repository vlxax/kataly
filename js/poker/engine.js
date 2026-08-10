
import { createDeck, shuffle } from './deck.js';

const RANK = {2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function combinations(arr, k){
  const out = [];
  function walk(start, cur){
    if(cur.length === k){
      out.push(cur.slice());
      return;
    }
    for(let i=start; i<arr.length; i++){
      cur.push(arr[i]);
      walk(i+1, cur);
      cur.pop();
    }
  }
  walk(0, []);
  return out;
}

function compareRank(a, b){
  const n = Math.max(a.length, b.length);
  for(let i=0; i<n; i++){
    const x = a[i] || 0;
    const y = b[i] || 0;
    if(x !== y) return x-y;
  }
  return 0;
}

function rankFive(cards){
  const values = cards.map(c => RANK[c[0]]).sort((a,b) => b-a);
  const suits = cards.map(c => c[1]);

  const counts = {};
  values.forEach(v => counts[v] = (counts[v] || 0) + 1);

  const groups = Object.keys(counts)
    .map(v => ({v:+v, n:counts[v]}))
    .sort((a,b) => b.n-a.n || b.v-a.v);

  const uniq = Array.from(new Set(values)).sort((a,b) => b-a);
  if(uniq[0] === 14) uniq.push(1);

  let straightHigh = 0;
  for(let i=0; i<=uniq.length-5; i++){
    if(uniq[i] - uniq[i+4] === 4){
      straightHigh = uniq[i];
      break;
    }
  }

  const flush = new Set(suits).size === 1;

  if(flush && straightHigh) return [8, straightHigh];
  if(groups[0].n === 4) return [7, groups[0].v, groups[1].v];

  if(groups[0].n === 3 && groups[1] && groups[1].n >= 2){
    return [6, groups[0].v, groups[1].v];
  }

  if(flush) return [5].concat(values);
  if(straightHigh) return [4, straightHigh];

  if(groups[0].n === 3){
    return [3, groups[0].v].concat(
      groups.filter(g => g.n === 1).map(g => g.v).sort((a,b)=>b-a)
    );
  }

  if(groups[0].n === 2 && groups[1] && groups[1].n === 2){
    const pairs = [groups[0].v, groups[1].v].sort((a,b)=>b-a);
    const kickerGroup = groups.find(g => g.n === 1);
    return [2, pairs[0], pairs[1], kickerGroup ? kickerGroup.v : 0];
  }

  if(groups[0].n === 2){
    return [1, groups[0].v].concat(
      groups.filter(g => g.n === 1).map(g => g.v).sort((a,b)=>b-a)
    );
  }

  return [0].concat(values);
}

export function evaluate7(cards){
  let best = null;
  const variants = combinations(cards, 5);
  for(let i=0; i<variants.length; i++){
    const r = rankFive(variants[i]);
    if(!best || compareRank(r, best) > 0) best = r;
  }
  return best;
}

export function rankLabel(rank){
  const labels = [
    'Старшая карта','Пара','Две пары','Сет',
    'Стрит','Флеш','Фулл-хаус','Каре','Стрит-флеш'
  ];
  return labels[(rank && rank[0]) || 0];
}

export class HoldemDemo {
  constructor({
    players,
    heroNick,
    stackBB=100,
    smallBlind=50,
    bigBlind=100,
    blindSchedule=null,
    levelSeconds=300,
    bigBlindAnte=true,
    botDelayMs=180,
    onChange,
    onHeroDecision,
    onHandEnd,
    onTournamentEnd
  }){
    this.heroNick = heroNick;
    this.baseSB = smallBlind;
    this.baseBB = bigBlind;
    this.sb = smallBlind;
    this.bb = bigBlind;
    this.ante = bigBlindAnte ? bigBlind : 0;
    this.bigBlindAnte = !!bigBlindAnte;
    this.botDelayMs = botDelayMs;

    const startingStack = Math.round(stackBB * bigBlind);

    this.players = players.map((p, i) => ({
      nick:p.nick,
      type:p.type || 'bot',
      style:p.style || '',
      seat:i,
      stack:startingStack,
      bet:0,
      totalBet:0,
      folded:false,
      out:false,
      allIn:false,
      hole:[],
      position:'',
      lastAction:''
    }));

    this.blindSchedule = blindSchedule || [
      {sb:50,bb:100,ante:100},
      {sb:75,bb:150,ante:150},
      {sb:100,bb:200,ante:200},
      {sb:150,bb:300,ante:300},
      {sb:200,bb:400,ante:400},
      {sb:300,bb:600,ante:600},
      {sb:400,bb:800,ante:800},
      {sb:500,bb:1000,ante:1000},
      {sb:600,bb:1200,ante:1200},
      {sb:800,bb:1600,ante:1600},
      {sb:1000,bb:2000,ante:2000}
    ];

    this.levelSeconds = levelSeconds;
    this.levelStartedAt = Date.now();
    this.level = 0;

    this.button = 0;
    this.handNo = 0;
    this.pot = 0;
    this.board = [];
    this.street = 'waiting';
    this.currentBet = 0;
    this.lastFullRaise = bigBlind;

    this.deck = [];
    this.log = [];
    this.handActions = [];
    this.sessionHands = [];
    this.eliminations = [];
    this.running = false;
    this.finished = false;

    this.onChange = onChange;
    this.onHeroDecision = onHeroDecision;
    this.onHandEnd = onHandEnd;
    this.onTournamentEnd = onTournamentEnd;

    this.timer = setInterval(() => {
      if(!this.finished){
        // Important: blind level is applied only BETWEEN hands.
        // During a hand we only refresh the countdown UI.
        if(!this.running) this.updateLevel();
        this.emit();
      }
    }, 1000);
  }

  destroy(){
    clearInterval(this.timer);
  }

  hero(){
    return this.players.find(p => p.nick === this.heroNick);
  }

  active(){
    return this.players.filter(p => !p.out && p.stack > 0);
  }

  liveInHand(){
    return this.players.filter(p => !p.out && !p.folded);
  }

  canAct(){
    return this.players.filter(p =>
      !p.out && !p.folded && !p.allIn && p.stack > 0
    );
  }

  updateLevel(){
    const elapsed = Math.floor((Date.now() - this.levelStartedAt) / 1000);
    const target = Math.min(
      this.blindSchedule.length - 1,
      Math.floor(elapsed / this.levelSeconds)
    );

    if(target !== this.level){
      this.level = target;
      const x = this.blindSchedule[target];
      this.sb = x.sb;
      this.bb = x.bb;
      this.ante = x.ante != null ? x.ante : x.bb;
      this.lastFullRaise = this.bb;
      this.log.push(`LEVEL ${this.level+1}: ${this.sb}/${this.bb}/${this.ante}`);
    }
  }

  levelRemaining(){
    const elapsed = Math.floor((Date.now() - this.levelStartedAt) / 1000);
    return Math.max(
      0,
      this.levelSeconds - (elapsed % this.levelSeconds)
    );
  }

  nextLevel(){
    return this.blindSchedule[
      Math.min(this.level+1, this.blindSchedule.length-1)
    ];
  }

  nextLive(from){
    for(let n=1; n<=this.players.length; n++){
      const i = (from+n) % this.players.length;
      const p = this.players[i];
      if(!p.out && p.stack > 0) return i;
    }
    return from;
  }

  firstPostflopActor(){
    return this.nextLive(this.button);
  }

  assignPositions(){
    this.players.forEach(p => p.position = '');
    const liveCount = this.active().length;
    if(!liveCount) return;

    if(liveCount === 2){
      this.players[this.button].position = 'BTN/SB';
      this.players[this.nextLive(this.button)].position = 'BB';
      return;
    }

    const labelsByCount = {
      3:['BTN','SB','BB'],
      4:['BTN','SB','BB','CO'],
      5:['BTN','SB','BB','UTG','CO'],
      6:['BTN','SB','BB','UTG','HJ','CO'],
      7:['BTN','SB','BB','UTG','MP','HJ','CO'],
      8:['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO'],
      9:['BTN','SB','BB','UTG','UTG+1','MP','MP+1','HJ','CO']
    };

    const labels = labelsByCount[liveCount] || labelsByCount[6];
    let idx = this.button;

    for(let i=0; i<labels.length; i++){
      this.players[idx].position = labels[i];
      idx = this.nextLive(idx);
    }
  }

  snapshot(){
    const active = this.active();
    const avgStack = active.reduce((s,p)=>s+p.stack,0) / Math.max(1,active.length);
    const hero = this.hero();

    return {
      players:this.players.map(p => ({
        ...p,
        hole:p.nick === this.heroNick ? p.hole : ['XX','XX'],
        stackBB:p.stack / this.bb,
        betBB:p.bet / this.bb
      })),
      heroHole:hero ? hero.hole.slice() : [],
      board:this.board.slice(),
      pot:this.pot,
      potBB:this.pot / this.bb,
      street:this.street,
      handNo:this.handNo,
      currentBet:this.currentBet,
      button:this.button,
      log:this.log.slice(-10),
      handActions:this.handActions.slice(),
      sb:this.sb,
      bb:this.bb,
      ante:this.ante,
      level:this.level+1,
      levelRemaining:this.levelRemaining(),
      nextLevel:this.nextLevel(),
      activePlayers:active.length,
      totalPlayers:this.players.length,
      averageStackBB:avgStack / this.bb,
      heroStackBB:(hero ? hero.stack : 0) / this.bb,
      eliminations:this.eliminations.slice(),
      finished:this.finished
    };
  }

  emit(){
    if(this.onChange) this.onChange(this.snapshot());
  }

  postDead(player, amount, label){
    const paid = Math.min(
      Math.max(0, Math.round(amount)),
      player.stack
    );

    player.stack -= paid;
    player.totalBet += paid;
    this.pot += paid;

    if(player.stack === 0) player.allIn = true;

    if(label){
      player.lastAction = label;
      this.log.push(`${player.nick}: ${label} ${paid.toLocaleString('ru-RU')}`);
    }

    return paid;
  }

  take(player, amount, label){
    const paid = Math.min(
      Math.max(0, Math.round(amount)),
      player.stack
    );

    player.stack -= paid;
    player.bet += paid;
    player.totalBet += paid;
    this.pot += paid;

    if(player.stack === 0) player.allIn = true;

    if(label){
      player.lastAction = label;
      this.log.push(`${player.nick}: ${label} ${paid.toLocaleString('ru-RU')}`);
    }

    return paid;
  }

  resetStreet(){
    this.players.forEach(p => {
      p.bet = 0;
      p.lastAction = '';
    });
    this.currentBet = 0;
    this.lastFullRaise = this.bb;
  }

  burn(){
    if(this.deck.length) this.deck.pop();
  }

  dealBoard(count){
    for(let i=0; i<count; i++){
      if(!this.deck.length) throw new Error('DECK_EMPTY');
      this.board.push(this.deck.pop());
    }
  }

  legalFor(player, raiseAllowed=true){
    const toCall = Math.max(0, this.currentBet - player.bet);
    const maxTarget = player.bet + player.stack;

    let minTarget;
    if(this.currentBet === 0){
      minTarget = this.bb;
    } else {
      minTarget = this.currentBet + this.lastFullRaise;
    }

    return {
      toCall,
      canCheck:toCall === 0,
      canRaise:raiseAllowed && maxTarget > this.currentBet,
      minRaise:Math.min(maxTarget, minTarget),
      maxRaise:maxTarget,
      stack:player.stack,
      pot:this.pot,
      bb:this.bb,
      stackBB:player.stack / this.bb,
      potBB:this.pot / this.bb,
      toCallBB:toCall / this.bb,
      position:player.position,
      currentBet:this.currentBet
    };
  }

  async startHand(){
    if(this.running || this.finished) return;

    if(this.active().length < 2){
      this.finishTournament();
      return;
    }

    this.updateLevel();
    this.running = true;
    this.handNo += 1;

    this.deck = shuffle(createDeck());
    this.board = [];
    this.pot = 0;
    this.street = 'preflop';
    this.handActions = [];
    this.log = [];
    this.currentBet = 0;
    this.lastFullRaise = this.bb;

    this.players.forEach(p => {
      p.bet = 0;
      p.totalBet = 0;
      p.folded = p.out;
      p.allIn = false;
      p.lastAction = '';
      p.hole = [];
    });

    // Two dealing rounds guarantee every active seat receives exactly two cards.
    let dealSeat = this.nextLive(this.button);
    const activeCount = this.active().length;
    for(let round=0; round<2; round++){
      let cursor = dealSeat;
      for(let n=0; n<activeCount; n++){
        const p = this.players[cursor];
        if(!p.out && p.stack > 0){
          if(!this.deck.length) throw new Error('DECK_EMPTY_HOLE_CARDS');
          p.hole.push(this.deck.pop());
        }
        cursor = this.nextLive(cursor);
      }
    }

    this.assignPositions();

    const live = this.active();
    let sbIndex;
    let bbIndex;

    if(live.length === 2){
      sbIndex = this.button;
      bbIndex = this.nextLive(this.button);
    } else {
      sbIndex = this.nextLive(this.button);
      bbIndex = this.nextLive(sbIndex);
    }

    if(this.bigBlindAnte && this.ante > 0){
      this.postDead(this.players[bbIndex], this.ante, 'BBA');
    } else if(this.ante > 0){
      this.active().forEach(p => this.postDead(p, this.ante, 'ANTE'));
    }

    this.take(this.players[sbIndex], this.sb, 'SB');
    this.take(this.players[bbIndex], this.bb, 'BB');

    this.currentBet = Math.max(
      this.players[sbIndex].bet,
      this.players[bbIndex].bet
    );

    this.emit();

    const preflopStart = live.length === 2
      ? sbIndex
      : this.nextLive(bbIndex);

    await this.bettingRound(preflopStart);

    if(this.liveInHand().length > 1){
      this.street = 'flop';
      this.resetStreet();
      this.burn();
      this.dealBoard(3);
      this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }

    if(this.liveInHand().length > 1){
      this.street = 'turn';
      this.resetStreet();
      this.burn();
      this.dealBoard(1);
      this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }

    if(this.liveInHand().length > 1){
      this.street = 'river';
      this.resetStreet();
      this.burn();
      this.dealBoard(1);
      this.emit();
      await this.bettingRound(this.firstPostflopActor());
    }

    this.finishHand();

    if(!this.finished){
      this.button = this.nextLive(this.button);
    }

    this.running = false;
  }

  async bettingRound(startIndex){
    if(this.liveInHand().length <= 1) return;

    let idx = startIndex;
    let acted = new Set();
    let raiseRights = new Set(
      this.canAct().map(p => p.seat)
    );
    let guard = 0;

    while(guard++ < 300){
      const actionableNow = this.canAct();

      // If everybody except one player is all-in and that player owes nothing,
      // there is no reason to force fake CHECKs on every remaining street.
      if(
        actionableNow.length === 0 ||
        (
          actionableNow.length === 1 &&
          actionableNow[0].bet >= this.currentBet
        )
      ){
        return;
      }

      const player = this.players[idx];

      if(
        !player.out &&
        !player.folded &&
        !player.allIn &&
        player.stack > 0
      ){
        const legal = this.legalFor(
          player,
          raiseRights.has(player.seat)
        );

        let action;

        if(player.nick === this.heroNick){
          action = await new Promise(resolve => {
            if(this.onHeroDecision){
              this.onHeroDecision(legal, resolve);
            } else {
              resolve({type:legal.canCheck ? 'check' : 'call'});
            }
          });
        } else {
          action = await this.botAction(player, legal);
        }

        const outcome = this.applyAction(
          player,
          action || {type:legal.canCheck ? 'check' : 'fold'},
          legal
        );

        // Once a player has acted, a short all-in raise does NOT restore
        // their raise right. Only a full legal raise reopens action.
        raiseRights.delete(player.seat);

        if(outcome.fullRaise){
          acted = new Set([player.seat]);
          raiseRights = new Set(
            this.canAct()
              .filter(p => p.seat !== player.seat)
              .map(p => p.seat)
          );
        } else {
          acted.add(player.seat);
        }

        this.emit();
      }

      if(this.liveInHand().length <= 1) return;

      const actionable = this.canAct();
      if(actionable.length === 0) return;

      if(
        actionable.length === 1 &&
        actionable[0].bet >= this.currentBet
      ){
        return;
      }

      const closed = actionable.every(p =>
        p.bet === this.currentBet && acted.has(p.seat)
      );

      if(closed) return;

      idx = this.nextLive(idx);
    }

    throw new Error('BETTING_LOOP_GUARD');
  }

  applyAction(player, action, legal){
    const actionType = action.type;
    let amount = 0;
    let fullRaise = false;

    if(actionType === 'fold'){
      player.folded = true;
      player.lastAction = 'FOLD';
      this.log.push(`${player.nick}: FOLD`);
    }

    else if(actionType === 'check'){
      if(!legal.canCheck){
        throw new Error('ILLEGAL_CHECK');
      }
      player.lastAction = 'CHECK';
      this.log.push(`${player.nick}: CHECK`);
    }

    else if(actionType === 'call'){
      amount = this.take(player, legal.toCall, 'CALL');
    }

    else if(actionType === 'allin'){
      const oldCurrent = this.currentBet;
      amount = this.take(player, player.stack, 'ALL-IN');

      if(player.bet > oldCurrent){
        const raiseSize = player.bet - oldCurrent;
        if(raiseSize >= this.lastFullRaise){
          this.lastFullRaise = raiseSize;
          fullRaise = true;
        }
        this.currentBet = player.bet;
      }
    }

    else if(actionType === 'raise'){
      if(!legal.canRaise){
        throw new Error('ILLEGAL_RAISE');
      }

      const requested = Math.round(Number(action.amount));
      if(!Number.isFinite(requested)){
        throw new Error('INVALID_RAISE_AMOUNT');
      }

      const target = Math.max(
        legal.minRaise,
        Math.min(legal.maxRaise, requested)
      );

      const oldCurrent = this.currentBet;
      amount = this.take(player, target - player.bet, 'RAISE');

      if(player.bet > oldCurrent){
        const raiseSize = player.bet - oldCurrent;
        if(raiseSize >= this.lastFullRaise){
          this.lastFullRaise = raiseSize;
          fullRaise = true;
        }
        this.currentBet = player.bet;
      }
    }

    else {
      throw new Error(`UNKNOWN_ACTION_${actionType}`);
    }

    this.handActions.push({
      handNo:this.handNo,
      street:this.street,
      player:player.nick,
      position:player.position,
      action:actionType,
      amountBB:amount / this.bb,
      toCallBB:legal.toCallBB,
      potAfterBB:this.pot / this.bb,
      stackAfterBB:player.stack / this.bb,
      heroHole:(this.hero() ? this.hero().hole.slice() : []),
      board:this.board.slice(),
      ts:Date.now()
    });

    return {fullRaise};
  }

  async botAction(player, legal){
    if(this.botDelayMs > 0){
      await sleep(this.botDelayMs + Math.random()*this.botDelayMs);
    }

    const power = this.preflopStrength(player.hole);
    const pressure = legal.toCall / Math.max(1, player.stack + legal.toCall);

    if(legal.toCall > 0 && power < 0.30 && pressure > 0.04){
      return {type:'fold'};
    }

    if(
      legal.canRaise &&
      power > 0.74 &&
      Math.random() < 0.46
    ){
      const target = Math.min(
        legal.maxRaise,
        Math.max(
          legal.minRaise,
          this.currentBet + Math.round(
            Math.max(this.bb*1.3, this.pot*0.55)
          )
        )
      );
      return {type:'raise', amount:target};
    }

    if(
      legal.toCall === 0 &&
      legal.canRaise &&
      power > 0.58 &&
      Math.random() < 0.28
    ){
      const target = Math.min(
        legal.maxRaise,
        Math.max(
          legal.minRaise,
          Math.round(Math.max(this.bb, this.pot*0.45))
        )
      );
      return {type:'raise', amount:target};
    }

    return {type:legal.canCheck ? 'check' : 'call'};
  }

  preflopStrength(hole){
    if(!hole || hole.length < 2) return 0.5;

    const a = RANK[hole[0][0]];
    const b = RANK[hole[1][0]];
    const pair = a === b;
    const suited = hole[0][1] === hole[1][1];
    const gap = Math.abs(a-b);

    let value = (a+b) / 30;
    if(pair) value += 0.25;
    if(suited) value += 0.07;
    if(gap > 5) value -= 0.08;

    return Math.max(0, Math.min(1, value));
  }

  buildSidePots(contenders){
    const contributors = this.players
      .filter(p => p.totalBet > 0)
      .map(p => ({player:p, amount:p.totalBet}));

    const levels = Array.from(
      new Set(contributors.map(x => x.amount))
    ).sort((a,b)=>a-b);

    const pots = [];
    let previous = 0;

    for(let i=0; i<levels.length; i++){
      const level = levels[i];
      const participants = contributors.filter(x => x.amount >= level);

      const size = (level - previous) * participants.length;
      previous = level;

      if(size <= 0) continue;

      const eligible = participants
        .map(x => x.player)
        .filter(p => contenders.includes(p));

      if(eligible.length){
        pots.push({size, eligible});
      }
    }

    return pots;
  }

  showdown(){
    const contenders = this.liveInHand();

    if(contenders.length === 1){
      return [{
        amount:this.pot,
        winners:[contenders[0]],
        label:'Без вскрытия'
      }];
    }

    const ranked = new Map();
    contenders.forEach(p => {
      ranked.set(p.nick, evaluate7(p.hole.concat(this.board)));
    });

    const sidePots = this.buildSidePots(contenders);
    const pots = sidePots.length
      ? sidePots
      : [{size:this.pot, eligible:contenders}];

    const awards = [];

    for(let i=0; i<pots.length; i++){
      const pot = pots[i];
      let best = null;
      let winners = [];

      pot.eligible.forEach(p => {
        const r = ranked.get(p.nick);

        if(!best || compareRank(r, best) > 0){
          best = r;
          winners = [p];
        } else if(compareRank(r, best) === 0){
          winners.push(p);
        }
      });

      if(!winners.length) continue;

      const baseShare = Math.floor(pot.size / winners.length);
      let remainder = pot.size - baseShare*winners.length;

      winners.forEach(w => {
        w.stack += baseShare;
      });

      // Odd chips clockwise from the button.
      let cursor = this.button;
      while(remainder > 0){
        cursor = this.nextLive(cursor);
        const winner = winners.find(w => w.seat === cursor);
        if(winner){
          winner.stack += 1;
          remainder -= 1;
        }
      }

      awards.push({
        amount:pot.size,
        winners:winners.map(w=>w.nick),
        label:rankLabel(best)
      });
    }

    return awards;
  }

  finishHand(){
    const awards = this.showdown();
    const winnerNames = [];

    awards.forEach(a => {
      a.winners.forEach(nick => {
        if(!winnerNames.includes(nick)) winnerNames.push(nick);
      });
    });

    const newlyOut = [];

    this.players.forEach(p => {
      if(p.stack <= 0 && !p.out){
        p.out = true;
        const place = this.active().length + 1;
        const elimination = {
          nick:p.nick,
          place,
          handNo:this.handNo,
          ts:Date.now()
        };
        this.eliminations.push(elimination);
        newlyOut.push(elimination);
      }
    });

    const summary = {
      handNo:this.handNo,
      pot:this.pot,
      winners:winnerNames,
      awards,
      board:this.board.slice(),
      heroHole:(this.hero() ? this.hero().hole.slice() : []),
      actions:this.handActions.slice(),
      label:awards.length ? awards[0].label : '',
      sb:this.sb,
      bb:this.bb,
      ante:this.ante,
      level:this.level+1,
      newlyOut
    };

    this.sessionHands.push(summary);

    if(awards.length === 1){
      this.log.push(
        `POT ${awards[0].amount.toLocaleString('ru-RU')} → ${awards[0].winners.join(', ')}`
      );
    } else {
      this.log.push(
        `SIDE POTS: ${awards.map(a =>
          `${a.amount.toLocaleString('ru-RU')}→${a.winners.join('/')}`
        ).join(' · ')}`
      );
    }

    if(newlyOut.length){
      this.log.push(
        `OUT: ${newlyOut.map(x=>`${x.nick} #${x.place}`).join(', ')}`
      );
    }

    this.emit();
    if(this.onHandEnd) this.onHandEnd(summary);

    const hero = this.hero();
    if(this.active().length <= 1 || (hero && hero.out)){
      this.finishTournament();
    }
  }

  finishTournament(){
    if(this.finished) return;

    this.finished = true;
    this.destroy();

    const active = this.active();

    if(
      active.length === 1 &&
      !this.eliminations.some(e => e.nick === active[0].nick)
    ){
      this.eliminations.push({
        nick:active[0].nick,
        place:1,
        handNo:this.handNo,
        ts:Date.now()
      });
    }

    const heroResult = this.eliminations.find(
      e => e.nick === this.heroNick
    );

    let heroPlace;
    if(heroResult){
      heroPlace = heroResult.place;
    } else if(active.length === 1 && active[0].nick === this.heroNick){
      heroPlace = 1;
    } else {
      heroPlace = Math.max(1, active.length);
    }

    if(this.onTournamentEnd){
      this.onTournamentEnd({
        heroPlace,
        totalPlayers:this.players.length,
        winner:active.length === 1 ? active[0].nick : null,
        eliminations:this.eliminations.slice().sort((a,b)=>a.place-b.place),
        handNo:this.handNo,
        level:this.level+1,
        sb:this.sb,
        bb:this.bb,
        ante:this.ante
      });
    }
  }
}
