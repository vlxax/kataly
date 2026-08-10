
import { HoldemDemo } from './poker/engine.js';

const suitSymbol={s:'♠',h:'♥',d:'♦',c:'♣'};

function money(n){
  return Math.round(Number(n)||0).toLocaleString('ru-RU');
}
function bb(n){
  const x=Number(n)||0;
  return (Math.round(x*10)/10).toFixed(x<10?1:0);
}
function clock(sec){
  sec=Math.max(0,Math.floor(Number(sec)||0));
  const m=Math.floor(sec/60),s=sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function cardHTML(c,hidden=false,small=false){
  if(hidden || !c || c==='XX'){
    return `<div class="room-card back ${small?'small':''}"><span>◆</span></div>`;
  }
  const r=c[0],s=c[1],red=s==='h'||s==='d';
  return `<div class="room-card ${red?'red':''} ${small?'small':''}">
    <b>${r}</b><span>${suitSymbol[s]}</span>
  </div>`;
}
function positionName(p){ return p.position||'—'; }

export function mountPokerTable({lobby,heroNick,onExit,onSessionEnd}){
  const root=document.createElement('div');
  root.className='poker-room';
  document.body.appendChild(root);

  const players=(lobby.players||[]).map(p=>({
    nick:p.nick,type:p.type||'bot',style:p.style||''
  }));

  let snapshot=null;
  let pendingLegal=null;
  let pendingResolve=null;
  let decisionStartedAt=0;
  let decisionTimer=null;
  let actionSeconds=18;
  let selectedRaise=0;
  let lastHand=null;
  let cancelled=false;
  let tournamentResult=null;
  let handBannerTimer=null;

  const engine=new HoldemDemo({
    players,
    heroNick,
    stackBB:lobby.stackBB||100,
    smallBlind:50,
    bigBlind:100,
    levelSeconds:300,
    bigBlindAnte:true,
    botDelayMs:260,
    onChange:s=>{
      if(cancelled)return;
      snapshot=s;
      render();
    },
    onHeroDecision:(legal,resolve)=>{
      pendingLegal=legal;
      pendingResolve=resolve;
      decisionStartedAt=Date.now();
      selectedRaise=Math.min(
        legal.maxRaise,
        Math.max(legal.minRaise,legal.currentBet||legal.minRaise)
      );
      startDecisionTimer();
      render();
    },
    onHandEnd:hand=>{
      lastHand=hand;
      pendingLegal=null;
      pendingResolve=null;
      stopDecisionTimer();
      showHandBanner(hand);
      // Poker-room flow: next hand starts automatically instead of a modal every hand.
      if(!engine.finished && !cancelled){
        setTimeout(()=>{
          if(!engine.finished && !engine.running && !cancelled) engine.startHand();
        },1500);
      }
    },
    onTournamentEnd:r=>{
      tournamentResult=r;
      pendingLegal=null;
      pendingResolve=null;
      stopDecisionTimer();
      setTimeout(showTournamentResult,500);
    }
  });

  const heroStart=(engine.hero()&&engine.hero().stack)||10000;
  const heroStartBB=lobby.stackBB||100;

  function seatPos(i,n){
    const maps={
      6:[[50,82],[16,68],[16,25],[50,11],[84,25],[84,68]],
      9:[[50,84],[25,78],[8,57],[10,29],[34,11],[66,11],[90,29],[92,57],[75,78]]
    };
    return (maps[n]||maps[6])[i]||[50,50];
  }

  function isHeroTurn(){
    return !!(
      snapshot &&
      pendingLegal &&
      snapshot.currentActorNick===heroNick
    );
  }

  function actionLabel(p){
    if(p.out)return 'OUT';
    if(p.folded)return 'FOLD';
    return p.lastAction||'';
  }

  function render(){
    if(!snapshot)return;

    const hero=snapshot.players.find(p=>p.nick===heroNick);
    const next=snapshot.nextLevel||{};
    const heroTurn=isHeroTurn();
    const callText=pendingLegal?bb(pendingLegal.toCallBB):'0';
    const effective=hero?Math.min(
      hero.stack,
      ...snapshot.players.filter(p=>!p.out&&!p.folded&&p.nick!==heroNick).map(p=>p.stack)
    ):0;

    root.innerHTML=`
      <div class="room-shell">
        <header class="room-topbar">
          <button class="room-icon" id="leaveGame">×</button>
          <button class="room-tourney" id="tourneyInfo">
            <b>КАТАЛЫ · MTT</b>
            <span>HAND #${snapshot.handNo} · LVL ${snapshot.level} · ${clock(snapshot.levelRemaining)}</span>
          </button>
          <div class="room-blinds">
            <span>${money(snapshot.sb)} / ${money(snapshot.bb)} / ${money(snapshot.ante)} BBA</span>
            <b>${snapshot.activePlayers}/${snapshot.totalPlayers} PLAYERS</b>
          </div>
          <button class="room-icon" id="roomMenu">•••</button>
        </header>

        <section class="room-table-wrap">
          <div class="room-felt">
            <div class="room-board">
              ${snapshot.board.map(c=>cardHTML(c)).join('')}
            </div>
            <div class="room-pot">
              <span>ОБЩИЙ БАНК</span>
              <b>${money(snapshot.pot)}</b>
              <em>${bb(snapshot.potBB)} BB</em>
            </div>
            <div class="room-meta-center">
              <span>AVG ${bb(snapshot.averageStackBB)} BB</span>
              <span>HERO ${bb(snapshot.heroStackBB)} BB</span>
            </div>
          </div>

          ${snapshot.players.map((p,i)=>{
            const [x,y]=seatPos(i,snapshot.players.length);
            const heroSeat=p.nick===heroNick;
            const acting=snapshot.currentActorSeat===p.seat;
            const label=actionLabel(p);
            return `<div class="room-seat ${heroSeat?'hero':''} ${acting?'acting':''} ${p.folded?'folded':''} ${p.out?'out':''}"
              style="left:${x}%;top:${y}%">
              <div class="room-seat-cards">
                ${(p.hole||[]).map(c=>cardHTML(c,c==='XX',true)).join('')}
              </div>
              <div class="room-avatar">${p.nick.slice(0,2).toUpperCase()}</div>
              <div class="room-playerbox">
                <div class="room-name">${p.nick}${heroSeat?' · YOU':''} <em>${positionName(p)}</em></div>
                <div class="room-stack">${money(p.stack)} <b>${bb(p.stackBB)} BB</b></div>
              </div>
              ${p.bet>0?`<div class="room-bet">${money(p.bet)}<span>${bb(p.betBB)} BB</span></div>`:''}
              ${label?`<div class="room-action-tag">${label}</div>`:''}
              ${p.seat===snapshot.button?'<div class="room-dealer">D</div>':''}
              ${acting?'<div class="room-thinking-ring"></div>':''}
            </div>`;
          }).join('')}
        </section>

        <section class="hero-zone">
          <div class="hero-zone-left">
            <div class="hero-zone-cards">${snapshot.heroHole.map(c=>cardHTML(c)).join('')}</div>
            <div class="hero-zone-info">
              <span>${hero?hero.position:'—'} · EFFECTIVE ${bb(effective/snapshot.bb)} BB</span>
              <b>${hero?money(hero.stack):0} · ${hero?bb(hero.stackBB):0} BB</b>
            </div>
          </div>
          <div class="hero-status ${heroTurn?'your-turn':''}">
            ${heroTurn?`ТВОЙ ХОД · <b id="decisionSeconds">${actionSeconds}</b>s`:`${snapshot.currentActorNick?`${snapshot.currentActorNick} думает…`:'РАЗДАЧА'}`}
          </div>
        </section>

        <section class="room-controls" id="roomControls">
          ${heroTurn?controlsHTML(pendingLegal,callText):waitingHTML()}
        </section>

        <div class="room-history">
          <button id="toggleLog">ИСТОРИЯ</button>
          <div class="room-log" id="roomLog">
            ${snapshot.log.slice(-5).map(x=>`<div>${x}</div>`).join('')}
          </div>
        </div>

        <div id="handBannerHost"></div>
      </div>`;

    wireStatic();
    if(heroTurn) wireControls();
  }

  function waitingHTML(){
    return `<div class="room-waiting">
      <div class="room-wait-dot"></div>
      <span>${snapshot&&snapshot.currentActorNick?`${snapshot.currentActorNick} принимает решение`:'Ждём следующего действия'}</span>
    </div>`;
  }

  function controlsHTML(legal,callText){
    const canCheck=legal.canCheck;
    return `
      <div class="decision-context">
        <span>POT ${bb(legal.potBB)} BB</span>
        <span>${canCheck?'CHECK AVAILABLE':`TO CALL ${callText} BB`}</span>
        <span>STACK ${bb(legal.stackBB)} BB</span>
      </div>

      <div class="quick-sizes ${legal.canRaise?'':'disabled'}">
        <button data-preset="0.25">25%</button>
        <button data-preset="0.33">33%</button>
        <button data-preset="0.50">50%</button>
        <button data-preset="0.66">66%</button>
        <button data-preset="1">POT</button>
        <button data-allin="1">ALL-IN</button>
      </div>

      <div class="raise-slider">
        <input id="raiseRange" type="range"
          min="${legal.minRaise}"
          max="${legal.maxRaise}"
          step="${Math.max(1,Math.round(legal.bb/10))}"
          value="${selectedRaise}">
        <div>
          <span>RAISE TO</span>
          <b id="raiseValue">${money(selectedRaise)} · ${bb(selectedRaise/legal.bb)} BB</b>
        </div>
      </div>

      <div class="main-actions">
        <button class="main-action fold" data-action="fold">FOLD</button>
        <button class="main-action call" data-action="${canCheck?'check':'call'}">
          ${canCheck?'CHECK':`CALL ${callText} BB`}
        </button>
        <button class="main-action raise" data-action="raise" ${legal.canRaise?'':'disabled'}>
          ${legal.currentBet>0?'RAISE':'BET'}
          <small>${bb(selectedRaise/legal.bb)} BB</small>
        </button>
      </div>
    `;
  }

  function wireStatic(){
    const leave=root.querySelector('#leaveGame');
    if(leave)leave.onclick=()=>{
      if(confirm('Выйти из сессии?')){
        cancelled=true;
        stopDecisionTimer();
        if(pendingResolve){
          const r=pendingResolve;pendingResolve=null;pendingLegal=null;
          r({type:'fold'});
        }
        engine.destroy();
        root.remove();
        onExit&&onExit();
      }
    };

    const info=root.querySelector('#tourneyInfo');
    if(info)info.onclick=showTournamentInfo;

    const menu=root.querySelector('#roomMenu');
    if(menu)menu.onclick=()=>showToast('Меню стола: настройки, звук и выход добавим следующим слоем.');

    const toggle=root.querySelector('#toggleLog');
    if(toggle)toggle.onclick=()=>{
      const log=root.querySelector('#roomLog');
      if(log)log.classList.toggle('open');
    };
  }

  function wireControls(){
    const range=root.querySelector('#raiseRange');
    const raiseValue=root.querySelector('#raiseValue');

    function syncRaise(){
      if(!range)return;
      selectedRaise=Number(range.value);
      if(raiseValue)raiseValue.textContent=`${money(selectedRaise)} · ${bb(selectedRaise/pendingLegal.bb)} BB`;
      const raiseBtn=root.querySelector('.main-action.raise small');
      if(raiseBtn)raiseBtn.textContent=`${bb(selectedRaise/pendingLegal.bb)} BB`;
    }

    if(range){
      range.oninput=syncRaise;
      syncRaise();
    }

    root.querySelectorAll('[data-preset]').forEach(btn=>{
      btn.onclick=()=>{
        if(!pendingLegal||!pendingLegal.canRaise)return;
        const fraction=Number(btn.dataset.preset);
        const raw=pendingLegal.currentBet + pendingLegal.toCall + pendingLegal.pot*fraction;
        selectedRaise=Math.max(
          pendingLegal.minRaise,
          Math.min(pendingLegal.maxRaise,Math.round(raw))
        );
        if(range){range.value=selectedRaise;syncRaise();}
      };
    });

    const allin=root.querySelector('[data-allin]');
    if(allin)allin.onclick=()=>submitHero({type:'allin'});

    root.querySelectorAll('[data-action]').forEach(btn=>{
      btn.onclick=()=>{
        const type=btn.dataset.action;
        if(type==='raise')submitHero({type:'raise',amount:selectedRaise});
        else submitHero({type});
      };
    });
  }

  function submitHero(action){
    if(!pendingResolve)return;
    const resolve=pendingResolve;
    pendingResolve=null;
    pendingLegal=null;
    stopDecisionTimer();
    actionSeconds=18;
    resolve(action);
    render();
  }

  function startDecisionTimer(){
    stopDecisionTimer();
    actionSeconds=18;
    decisionTimer=setInterval(()=>{
      actionSeconds-=1;
      const el=root.querySelector('#decisionSeconds');
      if(el)el.textContent=actionSeconds;
      if(actionSeconds<=0){
        const legal=pendingLegal;
        if(legal){
          submitHero({type:legal.canCheck?'check':'fold'});
        }else{
          stopDecisionTimer();
        }
      }
    },1000);
  }

  function stopDecisionTimer(){
    if(decisionTimer){
      clearInterval(decisionTimer);
      decisionTimer=null;
    }
  }

  function showHandBanner(hand){
    if(cancelled)return;
    clearTimeout(handBannerTimer);
    const won=(hand.winners||[]).includes(heroNick);
    const host=root.querySelector('#handBannerHost');
    if(!host)return;
    host.innerHTML=`<div class="hand-banner ${won?'won':''}">
      <b>${won?'БАНК ТВОЙ':'РАЗДАЧА ЗАВЕРШЕНА'}</b>
      <span>${(hand.winners||[]).join(', ')} · ${money(hand.pot)}</span>
    </div>`;
    handBannerTimer=setTimeout(()=>{
      const h=root.querySelector('#handBannerHost');
      if(h)h.innerHTML='';
    },1200);
  }

  function showTournamentInfo(){
    if(!snapshot)return;
    const next=snapshot.nextLevel||{};
    const modal=document.createElement('div');
    modal.className='room-modal';
    modal.innerHTML=`<div class="room-modal-card">
      <div class="room-modal-head">
        <div><span>TOURNAMENT INFO</span><b>КАТАЛЫ MTT</b></div>
        <button class="room-icon close">×</button>
      </div>
      <div class="room-info-grid">
        <div><span>LEVEL</span><b>${snapshot.level}</b></div>
        <div><span>NEXT IN</span><b>${clock(snapshot.levelRemaining)}</b></div>
        <div><span>BLINDS</span><b>${money(snapshot.sb)}/${money(snapshot.bb)}</b></div>
        <div><span>BBA</span><b>${money(snapshot.ante)}</b></div>
        <div><span>PLAYERS</span><b>${snapshot.activePlayers}/${snapshot.totalPlayers}</b></div>
        <div><span>AVG STACK</span><b>${bb(snapshot.averageStackBB)} BB</b></div>
        <div><span>HERO</span><b>${bb(snapshot.heroStackBB)} BB</b></div>
        <div><span>NEXT</span><b>${money(next.sb||snapshot.sb)}/${money(next.bb||snapshot.bb)}</b></div>
      </div>
    </div>`;
    root.appendChild(modal);
    modal.querySelector('.close').onclick=()=>modal.remove();
    modal.onclick=e=>{if(e.target===modal)modal.remove();};
  }

  function showTournamentResult(){
    if(!tournamentResult||cancelled)return;
    engine.destroy();
    stopDecisionTimer();
    const hero=engine.hero();
    const place=tournamentResult.heroPlace||engine.active().length;
    const prize=payoutFor(place,engine.players.length,lobby.buyIn);

    const overlay=document.createElement('div');
    overlay.className='room-modal tournament-end';
    overlay.innerHTML=`<div class="room-modal-card end-card">
      <div class="place-medal">${place===1?'🏆':place===2?'🥈':place===3?'🥉':'#'+place}</div>
      <span>ТУРНИР ЗАВЕРШЁН</span>
      <h2>${place===1?'ПОБЕДА':`${place} МЕСТО`}</h2>
      <div class="room-info-grid">
        <div><span>РУК</span><b>${engine.handNo}</b></div>
        <div><span>ПРИЗ</span><b>${money(prize)} 🪙</b></div>
        <div><span>ФИНИШНЫЙ СТЕК</span><b>${money(hero?hero.stack:0)}</b></div>
        <div><span>LEVEL</span><b>${engine.level+1}</b></div>
      </div>
      <button class="main-action raise" id="finishTournament">СМОТРЕТЬ РАЗБОР</button>
    </div>`;
    root.appendChild(overlay);

    overlay.querySelector('#finishTournament').onclick=()=>{
      const payload={
        hands:engine.handNo,
        handHistory:(engine.sessionHands||[]).slice(),
        actions:[].concat.apply([], (engine.sessionHands||[]).map(h=>h.actions||[])),
        stackStart:heroStart,
        stackEnd:hero?hero.stack:0,
        stackStartBB:heroStartBB,
        stackEndBB:(hero?hero.stack:0)/engine.baseBB,
        chipDelta:(hero?hero.stack:0)-heroStart,
        chipDeltaBB:((hero?hero.stack:0)-heroStart)/engine.baseBB,
        lastHand,
        tournament:{
          ...tournamentResult,
          prize,
          eliminations:(engine.eliminations||[]).slice(),
          finalSB:engine.sb,
          finalBB:engine.bb
        }
      };
      overlay.remove();
      root.remove();
      onSessionEnd&&onSessionEnd(payload);
    };
  }

  function payoutFor(place,total,buyIn){
    const pool=buyIn*total;
    const structure=total<=6?[.60,.25,.15]:[.50,.30,.20];
    return Math.round(pool*(structure[place-1]||0));
  }

  function showToast(text){
    const t=document.createElement('div');
    t.className='room-toast';
    t.textContent=text;
    root.appendChild(t);
    setTimeout(()=>t.remove(),1800);
  }

  engine.startHand().catch(err=>{
    console.error('TABLE START ERROR',err);
    showToast('Ошибка движка: '+err.message);
  });

  return engine;
}
