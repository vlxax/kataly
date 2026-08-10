
const suitSymbol={s:'♠',h:'♥',d:'♦',c:'♣'};

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
  el.innerHTML=`<b>${card[0]}</b><span>${suitSymbol[card[1]]}</span>`;
  return el;
}
function money(n){return Math.round(Number(n)||0).toLocaleString('ru-RU')}
function bb(n){const x=Number(n)||0;return (Math.round(x*10)/10).toFixed(x<10?1:0)}
function clock(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}

export class TableView{
  constructor({root,players,heroNick}){
    this.root=root;this.players=players;this.heroNick=heroNick;
    this.seats=new Map();this.board=[];this.controlsState=null;
    this.build();
  }

  build(){
    this.root.innerHTML=`
      <div class="v1-shell">
        <header class="v1-top">
          <button id="v1Exit" class="v1-icon">×</button>
          <div class="v1-title"><b>КАТАЛЫ</b><span id="v1Hand">HAND #1</span></div>
          <button id="v1Tournament" class="v1-tourney">
            <b id="v1Level">LVL 1 · 5:00</b>
            <span id="v1Blinds">0.5 / 1 / 1 BBA · <i id="v1Players">6/6</i></span>
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
          <div id="v1Banner" class="v1-banner"></div>
        </div>

        <div class="v1-hero-strip">
          <div id="v1HeroCards" class="v1-hero-cards"></div>
          <div class="v1-hero-meta"><span id="v1HeroPos">—</span><b id="v1HeroStack">—</b></div>
          <div id="v1TurnStatus" class="v1-turn-status">РАЗДАЧА</div>
        </div>

        <div id="v1Controls" class="v1-controls">
          <div class="v1-waiting">Ждём раздачу</div>
        </div>
      </div>`;

    const seatWrap=this.root.querySelector('#v1Seats');
    this.players.forEach((p,i)=>{
      const pos=this.seatPos(i,this.players.length);
      const seat=document.createElement('div');
      seat.className='v1-seat';
      seat.style.left=pos[0]+'%';seat.style.top=pos[1]+'%';
      seat.innerHTML=`
        <div class="v1-seat-cards"></div>
        <div class="v1-avatar">${p.nick.slice(0,2).toUpperCase()}</div>
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
  }

  seatPos(i,n){
    const maps={
      6:[[50,83],[15,69],[15,24],[50,10],[85,24],[85,69]]
    };
    return (maps[n]||maps[6])[i]||[50,50];
  }

  updateSnapshot(s){
    this.lastSnapshot=s;
    this.root.querySelector('#v1Hand').textContent=`HAND #${s.handNo}`;
    this.root.querySelector('#v1Level').textContent=`LVL ${s.level} · ${clock(s.levelRemaining)}`;
    this.root.querySelector('#v1Blinds').innerHTML=`${bb(s.sb/s.bb)} / 1 / ${bb(s.ante/s.bb)} BBA · <i id="v1Players">${s.activePlayers}/${s.totalPlayers}</i>`;
    const visiblePot=(s.settledPot!=null?s.settledPot:s.pot);
    this.root.querySelector('#v1Pot').textContent=money(visiblePot);
    this.root.querySelector('#v1PotBB').textContent=`${bb(visiblePot/s.bb)} BB`;

    s.players.forEach((p,i)=>{
      const seat=this.seats.get(i);if(!seat)return;
      seat.stack.innerHTML=`<b>${bb(p.stackBB)} BB</b><span>${money(p.stack)}</span>`;
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
      this.root.querySelector('#v1HeroPos').textContent=`${hero.position||'—'} · EFFECTIVE ${bb(s.heroStackBB)} BB`;
      this.root.querySelector('#v1HeroStack').textContent=`${bb(s.heroStackBB)} BB`;
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
    setTimeout(()=>chip.remove(),520);
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
    await new Promise(r=>setTimeout(r,720));
    ghosts.forEach(g=>g.remove());
    this.seats.forEach(seat=>{seat.bet.classList.remove('show');seat.bet.innerHTML=''});
    if(this.lastSnapshot){
      const settled=this.lastSnapshot.settledPot!=null?this.lastSnapshot.settledPot:this.lastSnapshot.pot;
      this.root.querySelector('#v1Pot').textContent=money(settled);
      this.root.querySelector('#v1PotBB').textContent=`${bb(settled/this.lastBB)} BB`;
    }
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
    this.seats.forEach(s=>s.ring.classList.remove('show'));
    const seat=this.seats.get(e.seat);if(seat)seat.ring.classList.add('show');
    this.root.querySelector('#v1TurnStatus').textContent=
      e.nick===this.heroNick?'ТВОЙ ХОД':`${e.nick} думает…`;
    this.root.querySelector('#v1TurnStatus').classList.toggle('hero',e.nick===this.heroNick);
  }

  showPlayerAction(type,e){
    const seat=this.seats.get(e.seat);if(!seat)return;
    const labels={
      PLAYER_FOLDED:'FOLD',PLAYER_CHECKED:'CHECK',PLAYER_CALLED:'CALL',
      PLAYER_RAISED:'RAISE',PLAYER_ALLIN:'ALL-IN'
    };
    seat.action.textContent=labels[type]||type;
    if(['PLAYER_CALLED','PLAYER_RAISED','PLAYER_ALLIN'].includes(type))this.animateChipsFromSeat(e.seat,type);
    if(e.bet && ['PLAYER_RAISED','PLAYER_ALLIN'].includes(type))seat.action.textContent+=` ${bb(e.bet/((this.lastBB)||100))} BB`;
    else if(e.amount && type==='PLAYER_CALLED')seat.action.textContent+=` ${bb(e.amount/((this.lastBB)||100))} BB`;
    seat.action.className='v1-action show '+type.toLowerCase().replace('player_','');
    if(type==='PLAYER_FOLDED'){
      Array.from(seat.cards.children).forEach((card,i)=>{
        card.style.transform=`translate(${i?8:-8}px,-8px) rotate(${i?12:-12}deg) scale(.86)`;
        card.style.opacity='.22';
      });
    }
    this.flashAction(seat,2200);
  }

  flashAction(seat,ms){
    clearTimeout(seat._actionTimer);
    seat._actionTimer=setTimeout(()=>{
      seat.action.classList.remove('show');
    },ms);
  }

  dealBoardCard(e){
    const node=cardNode(e.card,false);
    this.animateCardTo(this.root.querySelector('#v1Board'),node);
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
    setTimeout(()=>banner.classList.remove('show'),2600);
  }

  showHandResult(summary){
    const banner=this.root.querySelector('#v1Banner');
    banner.innerHTML=`<b>${summary.winners.includes(this.heroNick)?'БАНК ТВОЙ':'РУКА ЗАВЕРШЕНА'}</b><span>${summary.winners.join(', ')}</span>`;
    banner.classList.add('show');
    setTimeout(()=>banner.classList.remove('show'),2800);
  }

  showWaiting(text='Ждём действия'){
    this.root.querySelector('#v1Controls').innerHTML=`<div class="v1-waiting">${text}</div>`;
  }

  renderHeroControls(legal,onAction,street='preflop'){
    const c=this.root.querySelector('#v1Controls');
    const call=bb(legal.toCallBB),min=legal.minRaise,max=legal.maxRaise;
    let selected=Math.min(max,Math.max(min,legal.currentBet||min));
    const pre=street==='preflop';
    const presets=pre
      ? `<button data-bb="2.2">2.2x</button><button data-bb="2.5">2.5x</button><button data-bb="3">3x</button>`
      : `<button data-p="0.33">33%</button><button data-p="0.50">50%</button><button data-p="0.75">75%</button><button data-p="1">POT</button>`;

    c.innerHTML=`
      <div class="v1-context">
        <span>POT ${bb(legal.potBB)} BB</span>
        <span>${legal.canCheck?'CHECK':`TO CALL ${call} BB`}</span>
        <span>STACK ${bb(legal.stackBB)} BB</span>
      </div>
      <div class="v1-main-actions">
        <button data-a="fold" class="fold">FOLD</button>
        <button data-a="${legal.canCheck?'check':'call'}" class="call">${legal.canCheck?'CHECK':`CALL ${call} BB`}</button>
        <button id="v1RaiseOpen" class="raise" ${legal.canRaise?'':'disabled'}>${legal.currentBet?'RAISE':'BET'}</button>
      </div>
      <div id="v1RaiseDrawer" class="v1-raise-drawer">
        <div class="v1-presets">${presets}<button data-allin="1">ALL-IN</button></div>
        <input id="v1Range" type="range" min="${min}" max="${max}" step="${Math.max(1,Math.round(legal.bb/10))}" value="${selected}">
        <button id="v1RaiseConfirm" class="confirm">RAISE TO <b>${bb(selected/legal.bb)} BB</b></button>
      </div>`;

    c.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>onAction({type:b.dataset.a}));
    const drawer=c.querySelector('#v1RaiseDrawer'),range=c.querySelector('#v1Range'),confirm=c.querySelector('#v1RaiseConfirm');
    const sync=()=>{selected=Number(range.value);confirm.innerHTML=`RAISE TO <b>${bb(selected/legal.bb)} BB</b>`};
    c.querySelector('#v1RaiseOpen').onclick=()=>drawer.classList.toggle('open');
    range.oninput=sync;
    c.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{
      selected=Math.max(min,Math.min(max,Math.round(legal.currentBet+legal.toCall+legal.pot*Number(b.dataset.p))));
      range.value=selected;sync();
    });
    c.querySelectorAll('[data-bb]').forEach(b=>b.onclick=()=>{
      selected=Math.max(min,Math.min(max,Math.round(legal.bb*Number(b.dataset.bb))));
      range.value=selected;sync();
    });
    c.querySelector('[data-allin]').onclick=()=>onAction({type:'allin'});
    confirm.onclick=()=>onAction({type:'raise',amount:selected});
  }
}
