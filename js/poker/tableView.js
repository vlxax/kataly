
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
            <span id="v1Blinds">50 / 100 / 100 BBA</span>
          </button>
        </header>

        <div class="v1-table-stage">
          <div class="v1-felt">
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
    this.root.querySelector('#v1Hand').textContent=`HAND #${s.handNo}`;
    this.root.querySelector('#v1Level').textContent=`LVL ${s.level} · ${clock(s.levelRemaining)}`;
    this.root.querySelector('#v1Blinds').textContent=`${money(s.sb)} / ${money(s.bb)} / ${money(s.ante)} BBA`;
    this.root.querySelector('#v1Pot').textContent=money(s.pot);
    this.root.querySelector('#v1PotBB').textContent=`${bb(s.potBB)} BB`;

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

  postForcedBet(e){
    const seat=this.seats.get(e.seat);if(!seat)return;
    seat.action.textContent=e.label;
    seat.action.className='v1-action show forced';
    this.flashAction(seat,850);
  }

  dealCard(e){
    const seat=this.seats.get(e.seat);if(!seat)return;
    const node=cardNode(e.card,e.card==='XX');
    node.classList.add('deal-in');
    seat.cards.appendChild(node);

    if(e.nick===this.heroNick){
      const heroCard=cardNode(e.card,false);
      heroCard.classList.add('hero-deal-in');
      this.root.querySelector('#v1HeroCards').appendChild(heroCard);
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
    const node=cardNode(e.card,false);node.classList.add('board-in');
    this.root.querySelector('#v1Board').appendChild(node);
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

  showHandResult(summary){
    const banner=this.root.querySelector('#v1Banner');
    banner.innerHTML=`<b>${summary.winners.includes(this.heroNick)?'БАНК ТВОЙ':'РУКА ЗАВЕРШЕНА'}</b><span>${summary.winners.join(', ')}</span>`;
    banner.classList.add('show');
    setTimeout(()=>banner.classList.remove('show'),1000);
  }

  showWaiting(text='Ждём действия'){
    this.root.querySelector('#v1Controls').innerHTML=`<div class="v1-waiting">${text}</div>`;
  }

  renderHeroControls(legal,onAction){
    const c=this.root.querySelector('#v1Controls');
    const call=bb(legal.toCallBB);
    const min=legal.minRaise,max=legal.maxRaise;
    let selected=Math.min(max,Math.max(min,legal.currentBet||min));

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
        <div class="v1-presets">
          <button data-p="0.25">25%</button><button data-p="0.33">33%</button>
          <button data-p="0.50">50%</button><button data-p="0.66">66%</button>
          <button data-p="1">POT</button><button data-allin="1">ALL-IN</button>
        </div>
        <input id="v1Range" type="range" min="${min}" max="${max}" step="${Math.max(1,Math.round(legal.bb/10))}" value="${selected}">
        <button id="v1RaiseConfirm" class="confirm">RAISE TO <b>${bb(selected/legal.bb)} BB</b></button>
      </div>`;

    c.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>onAction({type:b.dataset.a}));
    const drawer=c.querySelector('#v1RaiseDrawer'),range=c.querySelector('#v1Range'),confirm=c.querySelector('#v1RaiseConfirm');
    const sync=()=>{selected=Number(range.value);confirm.innerHTML=`RAISE TO <b>${bb(selected/legal.bb)} BB</b>`};
    c.querySelector('#v1RaiseOpen').onclick=()=>drawer.classList.toggle('open');
    range.oninput=sync;
    c.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{
      const frac=Number(b.dataset.p);
      selected=Math.max(min,Math.min(max,Math.round(legal.currentBet+legal.toCall+legal.pot*frac)));
      range.value=selected;sync();
    });
    c.querySelector('[data-allin]').onclick=()=>onAction({type:'allin'});
    confirm.onclick=()=>onAction({type:'raise',amount:selected});
  }
}
