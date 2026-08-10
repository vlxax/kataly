
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
    <section class="hero">
      <div class="eyebrow">NL HOLD'EM · БОТЫ + РЕАЛЬНЫЕ ИГРОКИ</div>
      <h1>Собери стол.<br>Остальных добьём ботами.</h1>
      <p>6-max или 9-max. Зови друзей по инвайту, запускай сессию даже если никто не пришёл. Все твои действия позже пойдут в разбор Poker Brain.</p>
      <div class="actions">
        <button class="btn btn-primary" id="createTable">СОЗДАТЬ СТОЛ</button>
        <button class="btn btn-secondary" id="botTable">СЕСТЬ С БОТАМИ</button>
      </div>
    </section>

    <div class="section-head"><h2>Входящие</h2><span>${incoming.length?'можно принять':'пока тихо'}</span></div>
    <div id="incomingList">
      ${incoming.length ? incoming.map(i=>`
        <div class="card invite">
          <div class="avatar">${i.from.slice(0,2).toUpperCase()}</div>
          <div><h3>${i.from}</h3><p>${i.format} · ${i.seats} мест · бай-ин ${money(i.buyIn)}</p></div>
          <button class="btn btn-secondary" data-accept="${i.id}" style="padding:9px 10px">СЕСТЬ</button>
        </div>
      `).join('') : `<div class="card empty">Инвайтов нет. Можешь создать свой стол и позвать друга.</div>`}
    </div>

    <div class="section-head"><h2>Как это работает</h2><span>V0.1</span></div>
    <div class="card table-preview">
      <div class="eyebrow">ПРИМЕР · 6-MAX</div>
      <div class="table-visual">
        <div class="seat s1"><div class="avatar" style="width:34px;height:34px;border-radius:11px">LR</div><div class="chip">Лера · 100 BB</div></div>
        <div class="seat s2"><div class="avatar bot" style="width:34px;height:34px;border-radius:11px">GT</div><div class="chip bot">GTO_Monkey</div></div>
        <div class="seat s3"><div class="avatar bot" style="width:34px;height:34px;border-radius:11px">NK</div><div class="chip bot">NitKing</div></div>
        <div class="seat s4"><div class="avatar" style="width:34px;height:34px;border-radius:11px">FR</div><div class="chip">Друг · real</div></div>
        <div class="seat s5"><div class="avatar bot" style="width:34px;height:34px;border-radius:11px">BD</div><div class="chip bot">BluffDaddy</div></div>
        <div class="seat s6"><div class="avatar bot" style="width:34px;height:34px;border-radius:11px">CS</div><div class="chip bot">CallingStation</div></div>
        <div class="table-center"><div><b>2 реальных + 4 бота</b><span>недостающие места заполняются автоматически</span></div></div>
      </div>
    </div>
  `);

  $('#createTable').onclick=()=>{state.view='players';saveState();render();};
  $('#botTable').onclick=()=>openCreate(true);
  document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>{
    const inv=state.invites.find(x=>x.id===b.dataset.accept);
    if(inv){ inv.status='accepted'; saveState(); toast('Инвайт принят. Лобби создано.'); openLobby(createLobby({host:inv.from, seats:inv.seats, format:inv.format, buyIn:inv.buyIn, realPlayers:[state.nick, inv.from]}));}
  });
}

function openCreate(botOnly=false){
  const wrap=document.createElement('div');
  wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet">
    <div class="eyebrow">${botOnly?'БЫСТРАЯ ИГРА':'СОЗДАТЬ СТОЛ'}</div>
    <h2>${botOnly?'Сесть и играть':'Настрой свою катку'}</h2>
    <p>${botOnly?'Ты один реальный игрок. Остальные места сразу займут боты.':'Можно позвать сколько угодно людей. Незанятые места при старте заполнят боты.'}</p>

    <div class="field"><label>ФОРМАТ СТОЛА</label>
      <div class="option-grid">
        <button class="option active" data-seats="6"><b>6-MAX</b><span>быстрее, больше экшена</span></button>
        <button class="option" data-seats="9"><b>9-MAX</b><span>полный стол</span></button>
      </div>
    </div>

    <div class="field"><label>БАЙ-ИН</label>
      <div class="option-grid">
        <button class="option active" data-buyin="1000"><b>1 000 🪙</b><span>базовый стол</span></button>
        <button class="option" data-buyin="5000"><b>5 000 🪙</b><span>дороже и больнее</span></button>
      </div>
    </div>

    <div class="field"><label>СТАРТОВЫЙ СТЕК</label>
      <div class="option-grid">
        <button class="option active" data-stack="100"><b>100 BB</b><span>стандарт</span></button>
        <button class="option" data-stack="50"><b>50 BB</b><span>быстрее</span></button>
      </div>
    </div>

    ${botOnly?'':`<div class="field"><label>ПОЗВАТЬ ДРУГА</label><input id="friendNick" placeholder="Ник игрока, например GTO_Monkey"></div>`}

    <button class="btn btn-primary" id="buildLobby" style="width:100%">${botOnly?'СОБРАТЬ СТОЛ':'СОЗДАТЬ ЛОББИ'}</button>
    <button class="btn btn-secondary" id="closeSheet" style="width:100%;margin-top:8px">ОТМЕНА</button>
  </div>`;
  document.body.appendChild(wrap);

  let seats=6,buyIn=1000,stack=100;
  wrap.querySelectorAll('[data-seats]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-seats]').forEach(x=>x.classList.remove('active'));b.classList.add('active');seats=+b.dataset.seats});
  wrap.querySelectorAll('[data-buyin]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-buyin]').forEach(x=>x.classList.remove('active'));b.classList.add('active');buyIn=+b.dataset.buyin});
  wrap.querySelectorAll('[data-stack]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-stack]').forEach(x=>x.classList.remove('active'));b.classList.add('active');stack=+b.dataset.stack});
  $('#closeSheet').onclick=()=>wrap.remove();
  $('#buildLobby').onclick=()=>{
    const friend=botOnly?'':($('#friendNick')?.value||'').trim();
    if(buyIn>state.wallet){toast('Не хватает внутренней валюты');return}
    const realPlayers=[state.nick];
    if(friend) realPlayers.push(friend);
    const lobby=createLobby({host:state.nick,seats,format:'NL Hold’em',buyIn,stackBB:stack,realPlayers});
    if(friend){
      state.invites.unshift(createInvite({from:state.nick,to:friend,seats,buyIn,format:'NL Hold’em'}));
      saveState();
    }
    wrap.remove(); openLobby(lobby);
  };
}

function openLobby(lobby){
  const bots=makeBots(Math.max(0,lobby.seats-lobby.realPlayers.length));
  lobby.players=[
    ...lobby.realPlayers.map((nick,i)=>({nick,type:'real',host:i===0})),
    ...bots.map(b=>({nick:b.name,type:'bot',style:b.style}))
  ];

  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet">
    <div class="eyebrow">ЛОББИ · ${lobby.seats}-MAX</div>
    <h2>${lobby.format}</h2>
    <p>Бай-ин ${money(lobby.buyIn)} · стартовый стек ${lobby.stackBB} BB · призовой фонд ${money(lobby.buyIn*lobby.seats)}</p>
    <div class="card" style="padding:4px 14px;margin:14px 0">
      ${lobby.players.map((p,i)=>`<div class="lobby-seat">
        <div class="avatar" style="width:38px;height:38px;border-radius:12px">${p.nick.slice(0,2).toUpperCase()}</div>
        <div><b>${p.nick}${p.host?' · HOST':''}</b><span>${p.type==='real'?'реальный игрок':p.style}</span></div>
        <div class="tag ${p.type}">${p.type==='real'?'REAL':'BOT'}</div>
      </div>`).join('')}
    </div>
    <button class="btn btn-primary" id="startDemo" style="width:100%">НАЧАТЬ СЕССИЮ</button>
    <button class="btn btn-secondary" id="leaveLobby" style="width:100%;margin-top:8px">ВЫЙТИ</button>
  </div>`;
  document.body.appendChild(wrap);
  $('#leaveLobby').onclick=()=>wrap.remove();
  $('#startDemo').onclick=()=>{
    if(lobby.buyIn>state.wallet){toast('Не хватает внутренней валюты');return}
    state.wallet-=lobby.buyIn;
    const session=createSessionRecord(lobby);
    state.history.unshift(session);saveState();
    wrap.remove();toast('V0.1: сессия создана. Сам покерный движок будет в V0.2.');
    state.view='history';saveState();render();
  };
}


const DEMO_PLAYERS = [
  {nick:'GTO_Monkey',level:26,type:'Регуляр',avatar:'GT'},
  {nick:'AK_Shooter',level:19,type:'Агрессор',avatar:'AK'},
  {nick:'Fish_Whisperer',level:15,type:'Любитель',avatar:'FW'},
  {nick:'Bluff_Queen',level:31,type:'Профи',avatar:'BQ'},
  {nick:'NitOnline',level:22,type:'Регуляр',avatar:'NO'},
  {nick:'RiverPolice',level:18,type:'Дисциплина',avatar:'RP'},
  {nick:'PohuiCall',level:14,type:'Любопытный',avatar:'PC'}
];

function renderPlayers(){
  const selected = new Set();
  shell(`
    <div class="players-head">
      <button class="back-btn" id="playersBack">‹</button>
      <div><h1>ИГРОКИ</h1><p>Собери компанию. Пустые места займут боты.</p></div>
    </div>
    <div class="tabs"><button class="tab active">ИГРОКИ</button><button class="tab" data-go-invites>ПРИГЛАШЕНИЯ</button><button class="tab" data-go-history>ИСТОРИЯ</button></div>
    <input class="search" id="playerSearch" placeholder="⌕  Поиск игрока" autocomplete="off">
    <div class="online-title"><span>ОНЛАЙН</span><b>${DEMO_PLAYERS.length}</b></div>
    <div class="card" style="padding:3px 13px" id="playerList"></div>
    <div class="table-builder" id="tableBuilder">
      <div class="builder-top"><b>ТВОЙ СТОЛ · <span id="seatCount" style="color:white">1/6</span></b><span id="botCount">+ 5 ботов при старте</span></div>
      <div class="builder-people" id="builderPeople"></div>
      <div class="builder-actions"><button class="btn btn-secondary" id="botsNow">СРАЗУ С БОТАМИ</button><button class="btn btn-primary" id="continueTable">НАСТРОИТЬ СТОЛ</button></div>
    </div>
  `);

  const list=$('#playerList'), search=$('#playerSearch');
  function drawList(){
    const q=search.value.trim().toLowerCase();
    const rows=DEMO_PLAYERS.filter(p=>p.nick.toLowerCase().includes(q)||p.type.toLowerCase().includes(q));
    list.innerHTML=rows.length?rows.map(p=>`<div class="player-row">
      <div class="avatar" style="width:42px;height:42px;border-radius:13px">${p.avatar}</div>
      <div class="player-info"><h3><span class="online-dot"></span>${p.nick}</h3><p>Уровень ${p.level} · ${p.type}</p></div>
      <button class="invite-btn ${selected.has(p.nick)?'invited':''}" data-player="${p.nick}">${selected.has(p.nick)?'ПРИГЛАШЁН':'ПРИГЛАСИТЬ'}</button>
    </div>`).join(''):'<div class="empty">Никого не нашли.</div>';
    list.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{
      const nick=b.dataset.player;
      if(selected.has(nick)) selected.delete(nick); else if(selected.size<5) selected.add(nick); else return toast('Для 6-max уже достаточно игроков');
      drawList();drawBuilder();
    });
  }
  function drawBuilder(){
    const real=[state.nick,...selected];
    $('#seatCount').textContent=`${real.length}/6`;
    $('#botCount').textContent=real.length<6?`+ ${6-real.length} ${real.length===5?'бот':'ботов'} при старте`:'стол заполнен';
    $('#builderPeople').innerHTML=[...real.map(n=>`<div class="mini-avatar">${n.slice(0,2).toUpperCase()}</div>`),...Array(6-real.length).fill(0).map(()=>`<div class="mini-avatar empty">BOT</div>`)].join('');
  }
  search.oninput=drawList; drawList();drawBuilder();
  $('#playersBack').onclick=()=>{state.view='home';saveState();render()};
  document.querySelector('[data-go-invites]').onclick=()=>{state.view='invites';saveState();render()};
  document.querySelector('[data-go-history]').onclick=()=>{state.view='history';saveState();render()};
  $('#botsNow').onclick=()=>openCreate(true);
  $('#continueTable').onclick=()=>openCreateWithPlayers([...selected]);
}

function openCreateWithPlayers(selectedPlayers=[]){
  const wrap=document.createElement('div');wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="sheet">
    <div class="eyebrow">ШАГ 2 · НАСТРОЙКИ СТОЛА</div><h2>Почти погнали.</h2>
    <p>${selectedPlayers.length?`Ты позвала: ${selectedPlayers.join(', ')}. Остальные места при старте займут боты.`:'Ты пока никого не позвала — значит, боты сегодня твои лучшие друзья.'}</p>
    <div class="field"><label>ФОРМАТ</label><div class="option-grid"><button class="option active" data-seats="6"><b>6-MAX</b><span>быстрее и агрессивнее</span></button><button class="option" data-seats="9"><b>9-MAX</b><span>полный стол</span></button></div></div>
    <div class="field"><label>БАЙ-ИН</label><div class="option-grid"><button class="option active" data-buyin="1000"><b>1 000 🪙</b><span>базовый</span></button><button class="option" data-buyin="5000"><b>5 000 🪙</b><span>уже неприятно</span></button></div></div>
    <div class="field"><label>СТАРТОВЫЙ СТЕК</label><div class="option-grid"><button class="option active" data-stack="100"><b>100 BB</b><span>стандарт</span></button><button class="option" data-stack="50"><b>50 BB</b><span>быстрая сессия</span></button></div></div>
    <button class="btn btn-primary" id="buildSelectedLobby" style="width:100%">ПЕРЕЙТИ В ЛОББИ</button><button class="btn btn-secondary" id="closeSelected" style="width:100%;margin-top:8px">НАЗАД</button>
  </div>`;
  document.body.appendChild(wrap);
  let seats=6,buyIn=1000,stack=100;
  wrap.querySelectorAll('[data-seats]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-seats]').forEach(x=>x.classList.remove('active'));b.classList.add('active');seats=+b.dataset.seats});
  wrap.querySelectorAll('[data-buyin]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-buyin]').forEach(x=>x.classList.remove('active'));b.classList.add('active');buyIn=+b.dataset.buyin});
  wrap.querySelectorAll('[data-stack]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-stack]').forEach(x=>x.classList.remove('active'));b.classList.add('active');stack=+b.dataset.stack});
  $('#closeSelected').onclick=()=>wrap.remove();
  $('#buildSelectedLobby').onclick=()=>{
    if(buyIn>state.wallet)return toast('Не хватает внутренней валюты');
    const maxFriends=Math.max(0,seats-1), friends=selectedPlayers.slice(0,maxFriends);
    friends.forEach(friend=>state.invites.unshift(createInvite({from:state.nick,to:friend,seats,buyIn,format:'NL Hold’em'})));
    saveState();wrap.remove();openLobby(createLobby({host:state.nick,seats,format:'NL Hold’em',buyIn,stackBB:stack,realPlayers:[state.nick,...friends]}));
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
  if(state.view==='players') return renderPlayers();
  if(state.view==='invites') return renderInvites();
  if(state.view==='history') return renderHistory();
  if(state.view==='stats') return renderStats();
  return renderHome();
}

render();
