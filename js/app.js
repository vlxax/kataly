
import { state, saveState, resetDemo } from './state.js';
import { makeBots, BOT_ARCHETYPES } from './bots/botEngine.js';
import { createInvite, mockIncomingInvite } from './multiplayer/invites.js';
import { createLobby } from './multiplayer/lobby.js';
import { createSessionRecord } from './analytics/handHistory.js';

const $ = (q) => document.querySelector(q);
const app = document.getElementById('app');

function money(n){ return new Intl.NumberFormat('ru-RU').format(n) + ' 🪙'; }
function toast(text){
  document.querySelector('.toast')?.remove();
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
      <div class="wallet">БАНКРОЛЛ <b>${money(state.wallet)}</b></div>
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
    <div class="hint">Это демо-инвайт. Настоящий онлайн-мультиплеер подключим после игрового движка.</div>

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
    if(buyIn>state.wallet) return toast('Не хватает внутренней валюты');
    const lobby=createLobby({host:state.nick,seats,format:'NL Hold’em',buyIn,stackBB:100,realPlayers:[state.nick,...friends]});
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
    <button class="btn btn-primary" id="startDemo" style="width:100%">СЕСТЬ ЗА СТОЛ</button>
    <button class="btn btn-ghost" id="leaveLobby" style="width:100%">НАЗАД</button>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#leaveLobby').onclick=()=>wrap.remove();
  wrap.querySelector('#startDemo').onclick=()=>{
    if(lobby.buyIn>state.wallet) return toast('Не хватает внутренней валюты');
    state.wallet-=lobby.buyIn;
    const session=createSessionRecord(lobby); session.playerCount=lobby.seats; session.status='ready-for-engine';
    state.history.unshift(session); saveState(); wrap.remove();
    toast('Лобби работает. Следующий этап — игровой стол.'); state.view='history'; saveState(); render();
  };
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
  shell(`
    <div class="section-head" style="margin-top:4px"><h2>История</h2><span>пока демо</span></div>
    ${state.history.length?state.history.map(s=>`
      <div class="card" style="padding:16px;margin-bottom:9px">
        <div class="eyebrow">${new Date(s.createdAt).toLocaleString('ru-RU')}</div>
        <h3 style="margin:7px 0 5px">${s.seats}-MAX · ${s.format}</h3>
        <p style="margin:0;color:var(--muted);font-size:11px">Бай-ин ${money(s.buyIn)} · ${s.playerCount} игроков · статус: ${s.status}</p>
      </div>`).join(''):`<div class="card empty">Сыгранных сессий пока нет.</div>`}
  `);
}

function renderStats(){
  shell(`
    <div class="section-head" style="margin-top:4px"><h2>Статистика</h2><span>каркас V0.1</span></div>
    <div class="card" style="padding:18px">
      <div class="eyebrow">СЕССИОННАЯ АНАЛИТИКА</div>
      <h3 style="font-size:23px;margin:8px 0">Сначала записываем всё.</h3>
      <p style="font-size:12px;color:var(--muted);line-height:1.5">В V0.2 каждое действие будет попадать в hand history: улица, позиция, стек, банк, действие, размер ставки и время решения. Потом сюда добавятся VPIP/PFR/3-bet и анализ Poker Brain.</p>
    </div>
    <div class="card" style="padding:18px;margin-top:10px">
      <div class="eyebrow">СЕЙЧАС</div>
      <h3>${state.history.length}</h3>
      <p style="font-size:11px;color:var(--muted)">созданных тестовых сессий</p>
    </div>
  `);
}

function render(){
  if(state.view==='invites') return renderInvites();
  if(state.view==='history') return renderHistory();
  if(state.view==='stats') return renderStats();
  return renderHome();
}

render();
