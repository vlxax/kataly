import { analyzeSession } from './analytics/sessionAnalysis.js?v=130';
import { mountPokerTable } from './tableUI.js?v=180';

import { state, saveState } from './state.js?v=114';
import { makeBots } from './bots/botEngine.js?v=114';
import { createInvite, mockIncomingInvite } from './multiplayer/invites.js?v=114';
import { createLobby } from './multiplayer/lobby.js?v=114';

const $ = (q) => document.querySelector(q);
const app = document.getElementById('app');
const DEV_FREE_PLAY = true;
function devUnlock(){
  state.wallet = 999999999;
  try { saveState(); } catch(e) {}
  return true;
}
devUnlock();

state.wallet = 999999999;
saveState(); // force dev bankroll on every load // engine testing: buy-ins do not block table entry

function money(n){ return new Intl.NumberFormat('ru-RU').format(n) + ' 🪙'; }
function toast(text){
  { const oldToast=document.querySelector('.toast'); if(oldToast) oldToast.remove(); }
  const el=document.createElement('div'); el.className='toast'; el.textContent=text;
  document.body.appendChild(el); setTimeout(()=>el.remove(),2200);
}
function navButton(id,label){
  return `<button data-nav="${id}" class="${state.view===id?'active':''}">${label}</button>`;
}

function shell(content){
  app.innerHTML = `<div class="app-shell"><main class="phone">
    <div class="topbar">
      <div class="brand">КАТА<span>ЛЫ</span></div>
      <div class="wallet">${DEV_FREE_PLAY?'ТЕСТОВЫЙ БАНКРОЛЛ':'БАНКРОЛЛ'} <b>${money(state.wallet)}</b></div>
    </div>
    ${content}
  </main>
  <nav class="bottom-nav">
    ${navButton('home','ИГРАТЬ')}
    ${navButton('invites','ИНВАЙТЫ')}
    ${navButton('history','ИСТОРИЯ')}
    ${navButton('stats','СТАТИСТИКА')}
  </nav></div>`;
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{state.view=b.dataset.nav;saveState();render()});
}

function renderHome(){
  const incoming = state.invites.filter(x=>x.direction==='in' && x.status==='pending').slice(0,2);
  shell(`
    <section class="hero hero-clean">
      <div class="eyebrow">КАТАЛЫ · NL HOLD'EM</div>
      <h1>Сел.<br>Играешь.</h1>
      <p>Выбирай 6-max или 9-max. Хочешь — зови друзей. Все свободные места автоматически займут боты.</p>
      <div class="actions actions-single">
        <button class="btn btn-primary" id="playNow">ИГРАТЬ</button>
        <button class="btn btn-secondary" id="inviteFriends">ПРИГЛАСИТЬ ДРУЗЕЙ</button>
      </div>
    </section>

    <div class="section-head"><h2>Твой стол</h2><span>можно стартовать одному</span></div>
    <div class="card quick-table">
      <div class="quick-row"><span>Формат</span><b>6-max / 9-max</b></div>
      <div class="quick-row"><span>Реальные игроки</span><b>от 1</b></div>
      <div class="quick-row"><span>Свободные места</span><b class="pink">заполнят боты</b></div>
      <div class="quick-row"><span>После игры</span><b>статистика + разбор</b></div>
    </div>

    <div class="section-head"><h2>Входящие</h2><span>${incoming.length?'есть приглашения':'пока тихо'}</span></div>
    ${incoming.length ? incoming.map(i=>`
      <div class="card invite">
        <div class="avatar">${i.from.slice(0,2).toUpperCase()}</div>
        <div><h3>${i.from}</h3><p>${i.seats}-max · бай-ин ${money(i.buyIn)}</p></div>
        <button class="btn btn-secondary mini" data-accept="${i.id}">СЕСТЬ</button>
      </div>`).join('') : `<div class="card empty">Тебя пока никуда не зовут. Трагедия отменяется — стол всё равно соберут боты.</div>`}
  `);
  $('#playNow').onclick=()=>openGameSetup();
  $('#inviteFriends').onclick=()=>openGameSetup(true);
  document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>{
    const inv=state.invites.find(x=>x.id===b.dataset.accept);
    if(!inv) return;
    inv.status='accepted'; saveState();
    openLobby(createLobby({host:inv.from,seats:inv.seats,format:inv.format,buyIn:inv.buyIn,stackBB:100,realPlayers:[state.nick,inv.from]}));
  });
}

function openGameSetup(focusInvite=false){
  const wrap=document.createElement('div');
  wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet lobby-setup">
    <div class="sheet-handle"></div>
    <div class="eyebrow">НОВАЯ ИГРА</div>
    <h2>Собираем стол</h2>
    <p>Никого ждать не надо. Приглашай хоть 2, хоть 3, хоть 5 друзей — остальные места займут боты.</p>

    <div class="field"><label>ФОРМАТ</label>
      <div class="segmented">
        <button class="seg active" data-seats="6">6-MAX</button>
        <button class="seg" data-seats="9">9-MAX</button>
      </div>
    </div>

    <div class="field"><label>БАЙ-ИН</label>
      <div class="chip-options">
        <button class="chip-option active" data-buyin="1000">1K</button>
        <button class="chip-option" data-buyin="5000">5K</button>
        <button class="chip-option" data-buyin="10000">10K</button>
        <button class="chip-option" data-buyin="25000">25K</button>
      </div>
    </div>

    <div class="game-meta">
      <div><span>Стек</span><b>100 BB</b></div>
      <div><span>Блайнды</span><b>50 / 100</b></div>
      <div><span>Темп</span><b>Обычный</b></div>
    </div>

    <div class="section-head compact"><h2>Участники <span id="seatCounter">1/6</span></h2><span id="botCounter">5 ботов</span></div>
    <div id="seatList" class="seat-list"></div>

    <div class="invite-box">
      <input id="friendNick" placeholder="Ник друга">
      <button id="addFriend" class="btn btn-secondary mini">+ ДОБАВИТЬ</button>
    </div>
    <div class="hint">ТЕСТОВЫЙ РЕЖИМ: вход за стол сейчас бесплатный — игровая валюта не блокирует проверку движка.</div>

    <button class="btn btn-primary" id="goLobby" style="width:100%;margin-top:16px">ПРОДОЛЖИТЬ</button>
    <button class="btn btn-ghost" id="closeSheet" style="width:100%">ОТМЕНА</button>
  </div>`;
  document.body.appendChild(wrap);

  let seats=6,buyIn=1000;
  const friends=[];
  const seatList=wrap.querySelector('#seatList');
  const renderSeats=()=>{
    const real=[state.nick,...friends];
    const botCount=Math.max(0,seats-real.length);
    wrap.querySelector('#seatCounter').textContent=`${real.length}/${seats}`;
    wrap.querySelector('#botCounter').textContent=`${botCount} ${botCount===1?'бот':'ботов'}`;
    seatList.innerHTML=`
      ${real.map((nick,i)=>`<div class="player-slot real-slot"><div class="avatar small">${nick.slice(0,2).toUpperCase()}</div><div><b>${nick}</b><span>${i===0?'Ты · место гарантировано':'Друг · приглашён'}</span></div><em>REAL</em></div>`).join('')}
      ${Array.from({length:botCount},(_,i)=>`<div class="player-slot bot-slot"><div class="avatar small bot-avatar">B${i+1}</div><div><b>Свободное место</b><span>при старте сядет бот</span></div><em>BOT</em></div>`).join('')}`;
  };
  renderSeats();
  wrap.querySelectorAll('[data-seats]').forEach(b=>b.onclick=()=>{
    wrap.querySelectorAll('[data-seats]').forEach(x=>x.classList.remove('active')); b.classList.add('active'); seats=+b.dataset.seats;
    while(friends.length>seats-1) friends.pop(); renderSeats();
  });
  wrap.querySelectorAll('[data-buyin]').forEach(b=>b.onclick=()=>{
    wrap.querySelectorAll('[data-buyin]').forEach(x=>x.classList.remove('active')); b.classList.add('active'); buyIn=+b.dataset.buyin;
  });
  wrap.querySelector('#addFriend').onclick=()=>{
    const input=wrap.querySelector('#friendNick'); const nick=input.value.trim();
    if(!nick) return toast('Введи ник друга');
    if(friends.length>=seats-1) return toast('Стол уже заполнен');
    if(friends.some(x=>x.toLowerCase()===nick.toLowerCase())) return toast('Он уже приглашён');
    friends.push(nick); input.value='';
    state.invites.unshift(createInvite({from:state.nick,to:nick,seats,buyIn,format:'NL Hold’em'})); saveState(); renderSeats(); toast('Инвайт отправлен');
  };
  wrap.querySelector('#closeSheet').onclick=()=>wrap.remove();
  wrap.querySelector('#goLobby').onclick=()=>{
    
    const lobby=createLobby({host:state.nick,seats,format:'NL Hold’em',buyIn,stackBB:100,realPlayers:[state.nick,...friends]});lobby.sessionSeconds=600;
    wrap.remove(); openLobby(lobby);
  };
  if(focusInvite) setTimeout(()=>wrap.querySelector('#friendNick').focus(),100);
}

function openLobby(lobby){
  const bots=makeBots(Math.max(0,lobby.seats-lobby.realPlayers.length));
  lobby.players=[...lobby.realPlayers.map((nick,i)=>({nick,type:'real',host:i===0})),...bots.map(b=>({nick:b.name,type:'bot',style:b.style}))];
  const prize=lobby.buyIn*lobby.seats;
  const wrap=document.createElement('div'); wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet lobby-final">
    <div class="sheet-handle"></div>
    <div class="lobby-title"><div><div class="eyebrow">ЛОББИ · ${lobby.seats}-MAX</div><h2>Стол готов</h2></div><div class="live-dot">● READY</div></div>
    <div class="prize-card"><span>ПРИЗОВОЙ ФОНД</span><b>${money(prize)}</b><small>бай-ин ${money(lobby.buyIn)} · стек ${lobby.stackBB} BB</small></div>
    <div class="poker-table-mini">
      ${lobby.players.map((p,i)=>`<div class="mini-seat seat-${i+1}"><div class="avatar small ${p.type==='bot'?'bot-avatar':''}">${p.nick.slice(0,2).toUpperCase()}</div><b>${p.nick}</b><span>${p.type==='real'?'REAL':'BOT'}</span></div>`).join('')}
      <div class="felt-copy"><b>${lobby.seats}-MAX</b><span>50 / 100</span></div>
    </div>
    <div class="lobby-summary"><div><span>Людей</span><b>${lobby.realPlayers.length}</b></div><div><span>Ботов</span><b>${bots.length}</b></div><div><span>Мест</span><b>${lobby.seats}</b></div></div>
    <div class="engine-test-note">TURBO MTT · BBA · уровни 2:00 · выплаты TOP-3</div>
    <button class="btn btn-primary" id="startDemo" style="width:100%">ИГРАТЬ</button>
    <button class="btn btn-ghost" id="leaveLobby" style="width:100%">НАЗАД</button>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#leaveLobby').onclick=()=>wrap.remove();
  wrap.querySelector('#startDemo').onclick=()=>{
    
    if(!DEV_FREE_PLAY) state.wallet-=lobby.buyIn;
    saveState();
    wrap.remove();

    mountPokerTable({
      lobby,
      heroNick: state.nick,
      onExit: ()=>render(),
      onSessionEnd: (result)=>{
        const chipDelta = Math.round((result.chipDeltaBB!=null?result.chipDeltaBB:((result.stackEnd-result.stackStart)/100))*10)/10;
        const reward = (result.tournament && result.tournament.prize) || 0;
        if(!DEV_FREE_PLAY) state.wallet += reward;

        const session={
          id:'session_'+Math.random().toString(36).slice(2,10),
          createdAt:new Date().toISOString(),
          format:lobby.format,
          seats:lobby.seats,
          buyIn:lobby.buyIn,
          stackBB:lobby.stackBB,
          playerCount:lobby.players.length,
          status:'completed-demo',
          hands:result.hands,handsWon:result.handsWon||0,handsLost:result.handsLost||0,biggestPotBB:result.biggestPotBB||0,
          heroStackStart:result.stackStartBB!=null?result.stackStartBB:result.stackStart,
          heroStackEnd:result.stackEndBB!=null?result.stackEndBB:result.stackEnd,
          chipDelta,
          reward,
          place:(result.tournament && result.tournament.heroPlace) || null,
          tournament:result.tournament||null,
          lastHand:result.lastHand,
          handHistory:result.handHistory||[],
          actions:result.actions||[]
        };
        session.analysis=analyzeSession({hands:session.handHistory,heroNick:state.nick});
        state.history.unshift(session);
        saveState();
        showSessionResult(session);
      }
    });
  };
}


function showSessionResult(session){
  const won=session.chipDelta>0;
  const wrap=document.createElement('div');
  wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet session-result-sheet">
    <div class="sheet-handle"></div>
    <div class="eyebrow">ТУРНИРНАЯ СЕССИЯ</div>
    <h2>${session.place===1?'Победа':session.place?`${session.place} место`:won?'Плюсовая катка':'Сессия завершена'}</h2>
    <div class="result-money ${won?'positive':'negative'}">${session.chipDelta>0?'+':''}${session.chipDelta} BB</div>
    <p>${session.hands} рук · ${session.seats}-max · NL Hold’em</p>
    <div class="result-place"><b>${session.place||'—'} / ${session.playerCount}</b><span>ИТОГОВОЕ МЕСТО</span></div>

    <div class="result-grid">
      <div><span>Награда</span><b>${money(session.reward)}</b></div>
      <div><span>Бай-ин</span><b>${money(session.buyIn)}</b></div>
      <div><span>Старт</span><b>${session.heroStackStart} BB</b></div>
      <div><span>Финиш</span><b>${Math.round(session.heroStackEnd*10)/10} BB</b></div>
      <div><span>Выиграно рук</span><b>${session.handsWon||0}</b></div>
      <div><span>Проиграно рук</span><b>${session.handsLost||0}</b></div>
      <div><span>Крупнейший банк</span><b>${Math.round((session.biggestPotBB||0)*10)/10} BB</b></div>
      <div><span>Всего решений</span><b>${(session.actions||[]).filter(a=>a.player===state.nick).length}</b></div>
    </div>

    <div class="analysis-teaser">
      <div class="eyebrow">POKER BRAIN</div>
      <b>Оценка сессии: ${(session.analysis && session.analysis.overall) || 0}/100</b>
      <span>${(session.analysis && session.analysis.errors && session.analysis.errors.length) || 0} ошибок · ${(session.analysis && session.analysis.warnings && session.analysis.warnings.length) || 0} спорных решений · ${(session.analysis && session.analysis.stats && session.analysis.stats.decisions) || 0} решений записано.</span>
    </div>

    <button class="btn btn-primary" id="toHistory" style="width:100%">ПОСМОТРЕТЬ СЕССИЮ</button>
    <button class="btn btn-ghost" id="backHome" style="width:100%">В КАТАЛЫ</button>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#toHistory').onclick=()=>{wrap.remove();state.view='history';saveState();render()};
  wrap.querySelector('#backHome').onclick=()=>{wrap.remove();state.view='home';saveState();render()};
}

function renderInvites(){
  shell(`
    <div class="section-head" style="margin-top:4px"><h2>Инвайты</h2><span>${state.invites.length} всего</span></div>
    ${state.invites.length?state.invites.map(i=>`
      <div class="card invite">
        <div class="avatar">${(i.direction==='in'?i.from:i.to).slice(0,2).toUpperCase()}</div>
        <div><h3>${i.direction==='in'?'От '+i.from:'Для '+i.to}</h3><p>${i.format} · ${i.seats}-max · ${money(i.buyIn)}</p></div>
        <span class="pill">${i.status==='pending'?'ЖДЁМ':i.status.toUpperCase()}</span>
      </div>`).join(''):`<div class="card empty">Инвайтов ещё нет.</div>`}
    <button class="btn btn-secondary" id="mockInvite" style="width:100%;margin-top:12px">+ ДОБАВИТЬ ТЕСТОВЫЙ ИНВАЙТ</button>
  `);
  $('#mockInvite').onclick=()=>{state.invites.unshift(mockIncomingInvite());saveState();toast('Тестовый инвайт добавлен');render()};
}

function renderHistory(){
  const sessions=state.history.filter(s=>s.status==='completed-demo' || s.status==='played_demo');
  shell(`
    <div class="section-head" style="margin-top:4px"><h2>История</h2><span>${sessions.length} сессий</span></div>
    ${sessions.length?sessions.map(s=>`
      <div class="card session-card">
        <div class="session-card-top">
          <div><div class="eyebrow">${new Date(s.createdAt).toLocaleString('ru-RU')}</div><h3>${s.seats}-MAX · ${s.format}</h3></div>
          <div class="session-delta ${(s.chipDelta||0)>=0?'up':'down'}">${(s.chipDelta||0)>0?'+':''}${s.chipDelta||0} BB</div>
        </div>
        <div class="session-meta">
          <span>${s.place?`${s.place} место`:'сессия'}</span><span>${s.hands||0} рук</span><span>бай-ин ${money(s.buyIn)}</span><span>приз ${money(s.reward||0)}</span>
        </div>
        <div class="session-actions">
          <button class="btn btn-secondary" data-session="${s.id}">СТАТИСТИКА</button>
          <button class="btn btn-secondary" data-analysis="${s.id}">РАЗБОР</button>
        </div>
      </div>`).join(''):`<div class="card empty">Сыгранных сессий пока нет. Садись за стол — здесь появится история.</div>`}
  `);
  document.querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>showSessionDetails(b.dataset.session));
  document.querySelectorAll('[data-analysis]').forEach(b=>b.onclick=()=>showAnalysisStub(b.dataset.analysis));
}

function renderStats(){
  const sessions=state.history.filter(s=>s.status==='completed-demo' || s.status==='played_demo');
  const hands=sessions.reduce((a,s)=>a+(s.hands||0),0);
  const net=sessions.reduce((a,s)=>a+(s.chipDelta||0),0);
  const wins=sessions.filter(s=>s.place===1).length;
  const itm=sessions.filter(s=>s.place && s.place<=3).length;
  const bestPlace=sessions.filter(s=>s.place).length?Math.min(...sessions.filter(s=>s.place).map(s=>s.place)):null;
  const analyses=sessions.map(s=>s.analysis).filter(Boolean);
  const avgMetric=(key)=>analyses.length?Math.round(analyses.reduce((sum,a)=>sum+((a[key])!=null?(a[key]):0),0)/analyses.filter(a=>a[key]!=null).length):null;
  const pfScore=avgMetric('preflop'), postScore=avgMetric('postflop'), sizingScore=avgMetric('sizing'), disciplineScore=avgMetric('discipline');
  shell(`
    <div class="section-head" style="margin-top:4px"><h2>Статистика</h2><span>по сыгранным сессиям</span></div>
    <div class="stats-hero card">
      <div><span>СЕССИЙ</span><b>${sessions.length}</b></div>
      <div><span>РУК</span><b>${hands}</b></div>
      <div><span>РЕЗУЛЬТАТ</span><b class="${net>=0?'good':'bad'}">${net>0?'+':''}${Math.round(net*10)/10} BB</b></div>
      <div><span>ПОБЕД</span><b>${sessions.length?Math.round(wins/sessions.length*100):0}%</b></div>
      <div><span>ITM</span><b>${sessions.length?Math.round(itm/sessions.length*100):0}%</b></div>
      <div><span>ЛУЧШЕЕ МЕСТО</span><b>${bestPlace!=null?bestPlace:'—'}</b></div>
    </div>

    <div class="section-head"><h2>Игровой профиль</h2><span>следующий слой</span></div>
    <div class="card pokerbrain-preview">
      <div class="metric-row"><span>Префлоп</span><b>${pfScore!=null?pfScore:'—'}</b><small>средняя оценка решений</small></div>
      <div class="metric-row"><span>Постфлоп</span><b>${postScore!=null?postScore:'—'}</b><small>флоп + тёрн + ривер</small></div>
      <div class="metric-row"><span>Сайзинги</span><b>${sizingScore!=null?sizingScore:'—'}</b><small>оценка выбранных размеров</small></div>
      <div class="metric-row"><span>Дисциплина</span><b>${disciplineScore!=null?disciplineScore:'—'}</b><small>штраф за повторяющиеся ошибки</small></div>
    </div>
  `);
}

function showSessionDetails(id){
  const s=state.history.find(x=>x.id===id); if(!s)return;
  const a=s.analysis||analyzeSession({hands:s.handHistory||[],heroNick:state.nick});
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet session-detail-sheet">
    <div class="sheet-handle"></div><div class="eyebrow">СТАТИСТИКА СЕССИИ</div>
    <h2>${s.seats}-MAX · ${s.format}</h2>
    <div class="result-grid">
      <div><span>Рук</span><b>${s.hands||0}</b></div>
      <div><span>Результат</span><b>${(s.chipDelta||0)>0?'+':''}${s.chipDelta||0} BB</b></div>
      <div><span>VPIP*</span><b>${a.stats.vpip}%</b></div>
      <div><span>PFR*</span><b>${a.stats.pfr}%</b></div>
    </div>
    <div class="brain-score-grid">
      <div><span>Префлоп</span><b>${a.preflop!=null?a.preflop:'—'}</b></div>
      <div><span>Постфлоп</span><b>${a.postflop!=null?a.postflop:'—'}</b></div>
      <div><span>Сайзинги</span><b>${a.sizing!=null?a.sizing:'—'}</b></div>
      <div><span>Дисциплина</span><b>${a.discipline}</b></div>
    </div>
    <p class="tiny-note">* Пока это учебные метрики прототипа, рассчитанные по записанным решениям Hero, а не полноценный HUD.</p>
    <button class="btn btn-primary open-analysis" style="width:100%">РАЗОБРАТЬ ${a.errors.length+a.warnings.length} РЕШЕНИЙ</button>
    <button class="btn btn-secondary close-detail" style="width:100%;margin-top:8px">ЗАКРЫТЬ</button>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.close-detail').onclick=()=>wrap.remove();
  wrap.querySelector('.open-analysis').onclick=()=>{wrap.remove();showAnalysisStub(id)};
}
function showAnalysisStub(id){
  const s=state.history.find(x=>x.id===id); if(!s)return;
  const a=s.analysis||analyzeSession({hands:s.handHistory||[],heroNick:state.nick});
  const issues=[...a.errors,...a.warnings];
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet analysis-sheet">
    <div class="sheet-handle"></div>
    <div class="analysis-head">
      <div><div class="eyebrow">POKER BRAIN · РАЗБОР</div><h2>${a.overall}/100</h2></div>
      <div class="analysis-count"><b>${a.errors.length}</b><span>ошибок</span></div>
    </div>

    <div class="brain-score-grid compact">
      <div><span>Префлоп</span><b>${a.preflop!=null?a.preflop:'—'}</b></div>
      <div><span>Постфлоп</span><b>${a.postflop!=null?a.postflop:'—'}</b></div>
      <div><span>Сайзинг</span><b>${a.sizing!=null?a.sizing:'—'}</b></div>
      <div><span>Дисциплина</span><b>${a.discipline}</b></div>
    </div>

    <div class="analysis-section-title">ТРЕБУЮТ ВНИМАНИЯ · ${issues.length}</div>
    <div class="issue-list">
      ${issues.length?issues.slice(0,12).map((x,i)=>`
        <button class="issue-card ${x.severity}" data-issue="${i}">
          <div class="issue-top"><span>HAND #${x.handNo} · ${String(x.street).toUpperCase()}</span><b>${x.score}/100</b></div>
          <h3>${x.title}</h3>
          <p>${x.reason}</p>
          <small>${x.action.toUpperCase()} · банк после действия ${Math.round(x.potAfterBB*10)/10} BB</small>
        </button>`).join(''):`<div class="card empty">Критичных ошибок в этой короткой сессии не найдено.</div>`}
    </div>

    <div class="analysis-section-title">ЛИКИ</div>
    ${a.leaks.length?a.leaks.map(l=>`<div class="leak-card">
      <div><span>${l.status} · ${l.count} эпиз.</span><b>${l.trend}</b></div>
      <h3>${l.title}</h3><p>${l.text}</p>
      <button class="btn btn-secondary treat-leak">ЛЕЧИТЬ</button>
    </div>`).join(''):`<div class="card empty">Для уверенного лика нужен больший сэмпл. Сыграй ещё несколько сессий.</div>`}

    <button class="btn btn-secondary close-analysis" style="width:100%;margin-top:12px">ЗАКРЫТЬ</button>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.close-analysis').onclick=()=>wrap.remove();
  wrap.querySelectorAll('.treat-leak').forEach(b=>b.onclick=()=>toast('Дальше свяжем этот лик с персональным тренажёром.'));
  wrap.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>{
    const x=issues[+b.dataset.issue]; showHandBreakdown(x);
  });
}
function showHandBreakdown(x){
  const h=x.hand;
  const wrap=document.createElement('div');wrap.className='modal-backdrop hand-breakdown-layer';
  wrap.innerHTML=`<div class="sheet">
    <div class="sheet-handle"></div><div class="eyebrow">HAND #${h.handNo} · ${String(x.street).toUpperCase()}</div>
    <h2>${x.title}</h2>
    <div class="mini-cards">${(h.heroHole||[]).map(c=>`<span>${c}</span>`).join('')} <i>·</i> ${(h.board||[]).map(c=>`<span>${c}</span>`).join('')}</div>
    <div class="decision-verdict ${x.severity}">
      <b>${x.score}/100</b><span>${x.reason}</span>
    </div>
    <div class="hand-line">
      ${(h.actions||[]).map(a=>`<div class="${a.player===state.nick?'hero-line':''}"><span>${String(a.street).toUpperCase()} · ${a.player}</span><b>${a.action.toUpperCase()}${a.amountBB?' '+Math.round(a.amountBB*10)/10+' BB':''}</b></div>`).join('')}
    </div>
    <button class="btn btn-secondary close-hand" style="width:100%">НАЗАД К РАЗБОРУ</button>
  </div>`;
  document.body.appendChild(wrap);wrap.querySelector('.close-hand').onclick=()=>wrap.remove();
}

function render(){
  state.wallet = 999999999;
  saveState();
  if(state.view==='invites') return renderInvites();
  if(state.view==='history') return renderHistory();
  if(state.view==='stats') return renderStats();
  return renderHome();
}

render();
