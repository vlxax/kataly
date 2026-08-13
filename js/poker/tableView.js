
const suitSymbol={s:'♠',h:'♥',d:'♦',c:'♣'};

const avatarMap={
  GTO_Monkey:'assets/v1_1/bots/gto_monkey.jpeg',
  NitKing:'assets/v1_1/bots/nitking.jpeg',
  BluffDaddy:'assets/v1_1/bots/bluffdaddy.jpeg',
  CallingStation:'assets/v1_1/bots/callingstation.jpeg',
  MinRaiseBoss:'assets/v1_1/bots/minraiseboss.jpeg',
  RiverPolice:'assets/v1_1/bots/riverpolice.jpeg'
};
function avatarFor(p,heroNick){
  if(p.nick===heroNick)return 'assets/v1_1/bots/hero.png';
  return avatarMap[p.nick]||'';
}


function cardNode(card,hidden=false){
  const el=document.createElement('div');
  el.className='v1-card';
  if(hidden||!card||card==='XX'){
    el.classList.add('back');
    el.innerHTML='<span>◆</span>';
    return el;
  }
  const red=card[1]==='h'||card[1]==='d';
  if(red)el.classList.add('red');
  el.innerHTML=`<b>${card[0]}</b><span>${suitSymbol[card[1]]}</span><i>${suitSymbol[card[1]]}</i>`;
  return el;
}
function money(n){return Math.round(Number(n)||0).toLocaleString('ru-RU')}
function bb(n){const x=Number(n)||0;return (Math.round(x*10)/10).toFixed(x<10?1:0)}
function clock(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}

export class TableView{
  constructor({root,players,heroNick}){
    this.root=root;this.players=players;this.heroNick=heroNick;
    this.seats=new Map();this.board=[];this.controlsState=null;this.actionLog=[];this.tournamentOpen=false;
    this.build();
  }

  build(){
    this.root.innerHTML=`
      <div class="v1-shell">
        <header class="v1-top">
          <button id="v1Exit" class="v1-icon">×</button>
          <div class="v1-title"><b>POKER SWIPE</b><span>/ KATALY · <i id="v1Hand">HAND #1</i></span></div>
          <button id="v1History" class="v1-mini-icon" title="История">≡</button>
          <button id="v1SitOut" class="v1-mini-icon" title="Sit out">Ⅱ</button>
          <button id="v1Tournament" class="v1-tourney">
            <b id="v1Level">LVL 1 · 2:00</b>
            <span id="v1Blinds">50 / 100 / 100 BBA</span>
          </button>
        </header>

        <div class="v1-table-stage">
          <div class="v1-felt">
            <div id="v1Deck" class="v1-deck">◆</div>
            <div id="v1ChipLayer" class="v1-chip-layer"></div>
            <div id="v1Board" class="v1-board"></div>
            <div class="v1-pot"><span>POT</span><b id="v1Pot">0</b><em id="v1PotBB">0 BB</em></div>
          </div>
          <div id="v1Seats" class="v1-seats"></div>
          <div class="v1-live-hud">
            <div><span>LEFT</span><b id="v1Left">6/6</b></div>
            <div><span>AVG</span><b id="v1Avg">100 BB</b></div>
            <div><span>YOU</span><b id="v1Rank">1/6</b></div>
          </div>
          <div id="v1Banner" class="v1-banner"></div>
          <div id="v1HistoryDrawer" class="v1-history-drawer"><div class="v1-drawer-head"><b>ACTION HISTORY</b><button data-close-history>×</button></div><div id="v1ActionLog" class="v1-action-log"></div></div>
          <div id="v1TournamentPanel" class="v1-tournament-panel"><div class="v1-drawer-head"><b>TOURNAMENT</b><button data-close-tournament>×</button></div><div class="v1-tournament-body"><div><span>Players left</span><b id="v1InfoLeft">6 / 6</b></div><div><span>Average</span><b id="v1InfoAvg">100 BB</b></div><div><span>Your place</span><b id="v1InfoRank">1 / 6</b></div><div><span>Next blinds</span><b id="v1NextBlinds">75 / 150</b></div></div></div>
        </div>

        <div class="v1-hero-strip">
          <div id="v1HeroCards" class="v1-hero-cards"></div>
          <div class="v1-hero-meta"><span id="v1HeroPos">—</span><b id="v1HeroStack">—</b></div>
          <div class="v1-decision-clock"><b id="v1DecisionSeconds">—</b><span id="v1TimeBankLabel">TB 30s</span></div>
          <div id="v1TurnStatus" class="v1-turn-status">РАЗДАЧА</div>
        </div>

        <div id="v1Controls" class="v1-controls"></div>
      </div>`;

    const seatWrap=this.root.querySelector('#v1Seats');
    this.players.forEach((p,i)=>{
      const pos=this.seatPos(i,this.players.length);
      const seat=document.createElement('div');
      seat.className='v1-seat';
      seat.style.left=pos[0]+'%';seat.style.top=pos[1]+'%';
      seat.innerHTML=`
        <div class="v1-seat-cards"></div>
        <div class="v1-avatar${p.nick===this.heroNick?' hero-avatar':''}"${avatarFor(p,this.heroNick)?` style="background-image:url('${avatarFor(p,this.heroNick)}')"`:''}><span>${p.nick.slice(0,2).toUpperCase()}</span></div>
        <div class="v1-playerbox">
          <div class="v1-name">${p.nick}${p.nick===this.heroNick?' · YOU':''}<em></em></div>
          <div class="v1-stack">—</div>
        </div>
        <div class="v1-bet"></div>
        <div class="v1-action"></div>
        <div class="v1-dealer">D</div>
        <div class="v1-ring"></div>`;
      seatWrap.appendChild(seat);
      this.seats.set(i,{
        root:seat,cards:seat.querySelector('.v1-seat-cards'),
        stack:seat.querySelector('.v1-stack'),pos:seat.querySelector('.v1-name em'),
        bet:seat.querySelector('.v1-bet'),action:seat.querySelector('.v1-action'),
        dealer:seat.querySelector('.v1-dealer'),ring:seat.querySelector('.v1-ring')
      });
    });
    const ch=this.root.querySelector('[data-close-history]');if(ch)ch.onclick=()=>this.toggleHistory(false);
    const ct=this.root.querySelector('[data-close-tournament]');if(ct)ct.onclick=()=>this.toggleTournamentPanel(false);
    this.setHeroControlsIdle('Ждём раздачу');
  }

  seatPos(i,n){
    const maps={
      6:[[50,83],[15,69],[15,24],[50,10],[85,24],[85,69]],
      9:[[50,84],[24,78],[8,57],[12,25],[34,10],[66,10],[88,25],[92,57],[76,78]]
    };
    return (maps[n]||maps[6])[i]||[50,50];
  }

  updateSnapshot(s){
    this.root.querySelector('#v1Hand').textContent=`HAND #${s.handNo}`;
    this.root.querySelector('#v1Level').textContent=`LVL ${s.level} · ${clock(s.levelRemaining)}`;
    this.root.querySelector('#v1Blinds').textContent=`${money(s.sb)} / ${money(s.bb)} / ${money(s.ante)} BBA`;
    this.root.querySelector('#v1Pot').textContent=money(s.pot);
    this.root.querySelector('#v1PotBB').textContent=`${bb(s.potBB)} BB`;
    const left=`${s.activePlayers}/${s.totalPlayers}`;
    const rank=s.heroRank?`${s.heroRank}/${s.activePlayers}`:'OUT';
    this.root.querySelector('#v1Left').textContent=left;
    this.root.querySelector('#v1Avg').textContent=`${bb(s.averageStackBB)} BB`;
    this.root.querySelector('#v1Rank').textContent=rank;
    this.root.querySelector('#v1InfoLeft').textContent=left;
    this.root.querySelector('#v1InfoAvg').textContent=`${bb(s.averageStackBB)} BB`;
    this.root.querySelector('#v1InfoRank').textContent=rank;
    this.root.querySelector('#v1NextBlinds').textContent=`${money(s.nextSB)} / ${money(s.nextBB)} / ${money(s.nextAnte)}`;

    s.players.forEach((p,i)=>{
      const seat=this.seats.get(i);if(!seat)return;
      seat.stack.innerHTML=`${money(p.stack)} <b>${bb(p.stackBB)} BB</b>`;
      seat.pos.textContent=p.position?` ${p.position}`:'';
      seat.root.classList.toggle('folded',!!p.folded);
      seat.root.classList.toggle('out',!!p.out);
      seat.dealer.style.display=p.seat===s.button?'grid':'none';
      if(p.bet>0){
        seat.bet.innerHTML=`${money(p.bet)}<span>${bb(p.betBB)} BB</span>`;
        seat.bet.classList.add('show');
      }else{
        seat.bet.classList.remove('show');seat.bet.innerHTML='';
      }
    });

    const hero=s.players.find(p=>p.nick===this.heroNick);
    if(hero){
      this.root.querySelector('#v1HeroPos').textContent=`${hero.position||'—'} · ${bb(s.heroStackBB)} BB`;
      this.root.querySelector('#v1HeroStack').textContent=money(hero.stack);
    }
  }

  clearHand(){
    this.board=[];
    this.root.querySelector('#v1Board').innerHTML='';
    this.root.querySelector('#v1HeroCards').innerHTML='';
    this.seats.forEach(seat=>{
      seat.cards.innerHTML='';seat.action.textContent='';seat.action.className='v1-action';
      seat.bet.innerHTML='';seat.bet.classList.remove('show');
      seat.ring.classList.remove('show');
    });
  }

  animateCardTo(target,node){
    const deck=this.root.querySelector('#v1Deck');
    const stage=this.root.querySelector('.v1-table-stage');
    const sr=stage.getBoundingClientRect(), dr=deck.getBoundingClientRect(), tr=target.getBoundingClientRect();
    const ghost=node.cloneNode(true);
    ghost.classList.add('v1-flying-card');
    ghost.style.left=(dr.left-sr.left)+'px';ghost.style.top=(dr.top-sr.top)+'px';
    stage.appendChild(ghost);
    requestAnimationFrame(()=>{
      ghost.style.transform=`translate(${tr.left-dr.left+Math.max(0,(tr.width-38)/2)}px,${tr.top-dr.top}px) scale(.92)`;
      ghost.style.opacity='1';
    });
    setTimeout(()=>{ghost.remove();node.classList.add('deal-in');target.appendChild(node)},190);
  }

  animateChipsFromSeat(seatIndex,label=''){
    const seat=this.seats.get(seatIndex);if(!seat)return;
    const layer=this.root.querySelector('#v1ChipLayer'),stage=this.root.querySelector('.v1-table-stage');
    const sr=stage.getBoundingClientRect(),r=seat.root.getBoundingClientRect();
    const chip=document.createElement('div');chip.className='v1-chip-flight';chip.textContent='●';
    chip.style.left=(r.left-sr.left+r.width/2)+'px';chip.style.top=(r.top-sr.top+r.height/2)+'px';
    layer.appendChild(chip);
    requestAnimationFrame(()=>{chip.style.transform='translate(-50%,-50%) scale(.8)';chip.style.opacity='.25'});
    setTimeout(()=>chip.remove(),260);
  }

  async collectBets(){
    const stage=this.root.querySelector('.v1-table-stage'),sr=stage.getBoundingClientRect();
    const pot=this.root.querySelector('.v1-pot'),pr=pot.getBoundingClientRect();
    const ghosts=[];
    this.seats.forEach(seat=>{
      if(!seat.bet.classList.contains('show'))return;
      const r=seat.bet.getBoundingClientRect();
      const g=document.createElement('div');g.className='v1-collect-chip';g.textContent='●';
      g.style.left=(r.left-sr.left+r.width/2)+'px';g.style.top=(r.top-sr.top+r.height/2)+'px';
      stage.appendChild(g);ghosts.push(g);
      requestAnimationFrame(()=>g.style.transform=`translate(${pr.left-r.left}px,${pr.top-r.top}px) scale(.65)`);
    });
    await new Promise(r=>setTimeout(r,280));
    ghosts.forEach(g=>g.remove());
    this.seats.forEach(seat=>{seat.bet.classList.remove('show');seat.bet.innerHTML=''});
  }

  postForcedBet(e){
    const seat=this.seats.get(e.seat);if(!seat)return;
    seat.action.textContent=e.label;
    this.animateChipsFromSeat(e.seat,e.label);
    seat.action.className='v1-action show forced';
    this.flashAction(seat,850);
  }

  dealCard(e){
    const seat=this.seats.get(e.seat);if(!seat)return;
    if(e.nick===this.heroNick){
      const heroCard=cardNode(e.card,false);
      this.animateCardTo(this.root.querySelector('#v1HeroCards'),heroCard);
    }else{
      const node=cardNode(e.card,true);
      this.animateCardTo(seat.cards,node);
    }
  }

  setTurn(e){
    this.seats.forEach(s=>{
      s.ring.classList.remove('show');
      s.root.classList.remove('hero-turn','bot-turn');
    });
    const seat=this.seats.get(e.seat);
    const hero=e.nick===this.heroNick;
    if(seat){
      seat.ring.classList.add('show');
      seat.root.classList.add(hero?'hero-turn':'bot-turn');
    }
    const status=this.root.querySelector('#v1TurnStatus');
    const clock=this.root.querySelector('.v1-decision-clock');
    if(status){
      status.textContent=hero?'ТВОЙ ХОД':'';
      status.classList.toggle('hero',hero);
      status.classList.toggle('bot-hidden',!hero);
    }
    if(clock)clock.classList.toggle('bot-hidden',!hero);
  }

  showPlayerAction(type,e){
    const seat=this.seats.get(e.seat);if(!seat)return;
    const labels={
      PLAYER_FOLDED:'FOLD',PLAYER_CHECKED:'CHECK',PLAYER_CALLED:'CALL',
      PLAYER_RAISED:'RAISE',PLAYER_ALLIN:'ALL-IN'
    };
    seat.action.textContent=labels[type]||type;
    if(['PLAYER_CALLED','PLAYER_RAISED','PLAYER_ALLIN'].includes(type))this.animateChipsFromSeat(e.seat,type);
    if(e.bet)seat.action.textContent+=` ${bb(e.bet/((this.lastBB)||100))} BB`;
    seat.action.className='v1-action show '+type.toLowerCase().replace('player_','');
    this.flashAction(seat,1200);
  }

  flashAction(seat,ms){
    clearTimeout(seat._actionTimer);
    seat._actionTimer=setTimeout(()=>{
      seat.action.classList.remove('show');
    },ms);
  }

  dealBoardCard(e){
    const board=this.root.querySelector('#v1Board'),deck=this.root.querySelector('#v1Deck'),stage=this.root.querySelector('.v1-table-stage');
    const node=cardNode(e.card,false);node.classList.add('board-land');
    const sr=stage.getBoundingClientRect(),dr=deck.getBoundingClientRect(),br=board.getBoundingClientRect();
    const ghost=node.cloneNode(true);ghost.classList.add('v1-flying-card','board-flight');
    ghost.style.left=(dr.left-sr.left)+'px';ghost.style.top=(dr.top-sr.top)+'px';stage.appendChild(ghost);
    const slot=board.children.length,targetX=br.left-sr.left+slot*53,targetY=br.top-sr.top;
    requestAnimationFrame(()=>{ghost.style.transform=`translate(${targetX-(dr.left-sr.left)}px,${targetY-(dr.top-sr.top)}px) rotate(${slot%2?1.5:-1.5}deg) scale(1)`;ghost.style.opacity='1'});
    setTimeout(()=>{ghost.remove();board.appendChild(node);requestAnimationFrame(()=>node.classList.add('landed'))},360);
  }

  revealCards(e){
    const seat=this.seats.get(e.seat);if(!seat)return;
    seat.cards.innerHTML='';
    e.cards.forEach(c=>seat.cards.appendChild(cardNode(c,false)));
  }

  showPotAward(e){
    const banner=this.root.querySelector('#v1Banner');
    banner.innerHTML=`<b>${e.winners.join(', ')}</b><span>+${money(e.amount)}</span>`;
    banner.classList.add('show','win');
    setTimeout(()=>banner.classList.remove('show'),1200);
  }

  showHandResult(summary,review){
    const banner=this.root.querySelector('#v1Banner');
    const won=summary.winners.includes(this.heroNick);
    let note='';
    if(review&&review.stats&&review.stats.decisions){
      const issue=(review.errors&&review.errors[0])||(review.warnings&&review.warnings[0]);
      note=issue?`${issue.title} · ${issue.score}/100`:`Решения ${review.overall}/100`;
    }
    banner.innerHTML=`<b>${won?'БАНК ТВОЙ':'РУКА ЗАВЕРШЕНА'}</b><span>${summary.winners.join(', ')}${note?` · ${note}`:''}</span>`;
    banner.classList.add('show',won?'win':'');
    setTimeout(()=>banner.classList.remove('show','win'),2200);
  }

  toggleHistory(force){
    const d=this.root.querySelector('#v1HistoryDrawer');if(!d)return;
    const open=typeof force==='boolean'?force:!d.classList.contains('open');
    d.classList.toggle('open',open);
  }

  toggleTournamentPanel(force){
    const d=this.root.querySelector('#v1TournamentPanel');if(!d)return;
    const open=typeof force==='boolean'?force:!d.classList.contains('open');
    d.classList.toggle('open',open);
  }

  logAction(entry={}){
    this.actionLog.push(entry);if(this.actionLog.length>40)this.actionLog.shift();
    const wrap=this.root.querySelector('#v1ActionLog');if(!wrap)return;
    wrap.innerHTML=this.actionLog.slice().reverse().map(x=>x.kind==='street'
      ?`<div class="v1-log-street">${x.text||''}</div>`
      :`<div class="v1-log-row ${x.kind||''}"><span>${x.street?String(x.street).toUpperCase():''}</span><b>${x.nick||''}</b><em>${x.text||''}</em></div>`).join('');
  }

  updateDecisionClock(seconds,timeBank){
    const a=this.root.querySelector('#v1DecisionSeconds'),b=this.root.querySelector('#v1TimeBankLabel');
    if(a)a.textContent=seconds>0?`${seconds}s`:'0s';
    if(b)b.textContent=`TB ${timeBank}s`;
  }

  flashTimeBank(added,left){
    this.updateDecisionClock(added,left);
    const el=this.root.querySelector('.v1-decision-clock');if(!el)return;
    el.classList.add('used');setTimeout(()=>el.classList.remove('used'),450);
    const btn=this.root.querySelector('#v1TimeBank');if(btn){btn.textContent=`TIME BANK +10s · ${left}s`;if(left<=0)btn.disabled=true;}
  }

  setSitOut(active){
    const b=this.root.querySelector('#v1SitOut');if(!b)return;
    b.classList.toggle('active',active);b.textContent=active?'▶':'Ⅱ';b.title=active?'Вернуться в игру':'Sit out';
    this.showWaiting(active?'SIT OUT · авто-check/fold':'Возвращаемся в игру');
  }

  showTournamentEnd(result,prize){
    const banner=this.root.querySelector('#v1Banner');if(!banner)return;
    banner.innerHTML=`<b>${result.heroPlace===1?'ПОБЕДА':`${result.heroPlace} МЕСТО`}</b><span>${prize?`Приз ${money(prize)}`:'Вне призов'} · ${result.handNo} рук</span>`;
    banner.classList.add('show',result.heroPlace===1?'win':'');
  }

  setBotThinking(seatIndex,plan={}){
    const seat=this.seats.get(seatIndex);if(!seat)return;
    // У бота только один индикатор мышления: жёлтый круг вокруг аватара.
    // Никаких вторых жёлтых/розовых плашек и текста «думает» на панели Hero.
    seat.root.classList.add('thinking','bot-turn');
    seat.action.textContent='';
    seat.action.className='v1-action';
  }

  updateBotThinking(seatIndex,left){
    // Намеренно ничего не рисуем: оставляем только жёлтый круг у самого игрока.
  }

  clearBotThinking(seatIndex){
    const seat=this.seats.get(seatIndex);if(!seat)return;
    seat.root.classList.remove('thinking','bot-turn');
    seat.action.textContent='';
    seat.action.className='v1-action';
  }

  showWaiting(text='Ждём действия'){ this.setHeroControlsIdle(text); }

  setHeroControlsIdle(text='Ждём твоего хода'){
    const c=this.root.querySelector('#v1Controls');if(!c)return;
    // Панель Hero всегда на месте, но без сдвоенных CHECK/CALL и BET/RAISE.
    c.innerHTML=`<div class="v1-context"><span>${text}</span><span>ПАНЕЛЬ HERO</span></div>
      <div class="v1-main-actions idle-actions">
        <button type="button" class="fold" disabled>FOLD</button>
        <button type="button" class="call" disabled>CHECK</button>
        <button type="button" class="raise" disabled>BET</button>
      </div>`;
  }

  renderHeroControls(legal,onAction,street='preflop',extras={}){
    const c=this.root.querySelector('#v1Controls');
    const call=bb(legal.toCallBB),min=legal.minRaise,max=legal.maxRaise,step=Math.max(1,Math.round(legal.bb/2));
    let selected=Math.max(min,Math.min(max,legal.currentBet?Math.round(legal.currentBet*2.5):Math.round(Math.max(legal.bb,legal.pot*.5))));
    const pre=street==='preflop',verb=legal.currentBet?'RAISE':'BET';
    const presets=pre
      ? `<button data-bb="2">2x</button><button data-bb="2.5">2.5x</button><button data-bb="3">3x</button><button data-bb="4">4x</button>`
      : `<button data-p="0.25">25%</button><button data-p="0.33">33%</button><button data-p="0.50">50%</button><button data-p="0.66">66%</button><button data-p="1">POT</button>`;
    c.innerHTML=`
      <div class="v1-context"><span>POT ${bb(legal.potBB)} BB</span><span>${legal.canCheck?'CHECK':`TO CALL ${call} BB`}</span><span>STACK ${bb(legal.stackBB)} BB</span><button id="v1TimeBank" class="v1-timebank-btn" ${extras.timeBank>0?'':'disabled'}>TIME BANK +10s · ${extras.timeBank||0}s</button></div>
      <div class="v1-main-actions"><button type="button" data-a="fold" class="fold">FOLD</button><button type="button" data-a="${legal.canCheck?'check':'call'}" class="call">${legal.canCheck?'CHECK':`CALL ${call} BB`}</button><button type="button" id="v1RaiseOpen" class="raise" ${legal.canRaise?'':'disabled'}>${verb} ${legal.canRaise?bb(selected/legal.bb)+' BB':''}</button></div>
      <div id="v1RaiseDrawer" class="v1-raise-drawer open">
        <div class="v1-presets">${presets}<button type="button" data-allin="1">ALL-IN</button></div>
        <div class="v1-size-line"><button type="button" data-step="-1">−</button><input id="v1Range" type="range" min="${min}" max="${max}" step="${step}" value="${selected}"><button type="button" data-step="1">+</button></div>
        <div class="v1-size-entry"><input id="v1SizeBB" inputmode="decimal" type="number" step="0.5" value="${bb(selected/legal.bb)}"><span>BB</span></div>
        <button type="button" id="v1RaiseConfirm" class="confirm">${verb} TO <b>${bb(selected/legal.bb)} BB</b></button>
      </div>`;
    const tb=c.querySelector('#v1TimeBank');if(tb&&extras.onTimeBank)tb.onclick=()=>extras.onTimeBank();
    c.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>onAction({type:b.dataset.a}));
    if(!legal.canRaise)return;
    const drawer=c.querySelector('#v1RaiseDrawer'),range=c.querySelector('#v1Range'),entry=c.querySelector('#v1SizeBB'),confirm=c.querySelector('#v1RaiseConfirm'),open=c.querySelector('#v1RaiseOpen');
    const set=x=>{selected=Math.max(min,Math.min(max,Math.round(Number(x)/step)*step));range.value=selected;entry.value=bb(selected/legal.bb);confirm.innerHTML=`${verb} TO <b>${bb(selected/legal.bb)} BB</b>`;open.textContent=`${verb} ${bb(selected/legal.bb)} BB`};
    range.oninput=()=>set(range.value);entry.onchange=()=>set(Number(entry.value)*legal.bb);
    c.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>set(selected+Number(b.dataset.step)*step));
    c.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>set(legal.currentBet+legal.toCall+(legal.pot+legal.toCall)*Number(b.dataset.p)));
    c.querySelectorAll('[data-bb]').forEach(b=>b.onclick=()=>set(legal.bb*Number(b.dataset.bb)));
    c.querySelector('[data-allin]').onclick=()=>onAction({type:'allin'});confirm.onclick=()=>onAction({type:'raise',amount:selected});
    open.onclick=()=>{drawer.classList.add('open');entry.focus();entry.select()};set(selected);
  }

}
