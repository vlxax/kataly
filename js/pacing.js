/*
  KATALY Human Table Patch v1.4
  1) Боты реально "думают": быстрые фолды, обычные решения, танки и редкий time bank.
  2) Разные характеры игроков дают разный темп.
  3) Между улицами есть пауза; флоп визуально выкладывается по карте.
  4) Сайзинг BET/RAISE всегда доступен: пресеты, +/- 0.5 BB, числовой ввод, slider, all-in.
  5) Никаких изменений покерного state machine: legal min/max остаются источником истины.
*/

import { HoldemDemo } from './poker/engine.js?v=130';
import { TableView } from './poker/tableView.js?v=130';
import { TableController } from './poker/tableController.js?v=130';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnd = (a, b) => a + Math.random() * (b - a);
const roundTo = (x, step) => Math.round(x / step) * step;

const PLAYER_PACE = {
  GTO_Monkey:      { speed: 1.02, tank: .14, timebank: .035 },
  NitKing:         { speed: 1.22, tank: .18, timebank: .045 },
  BluffDaddy:      { speed: 1.12, tank: .22, timebank: .060 },
  CallingStation:  { speed: .92, tank: .10, timebank: .025 },
  MinRaiseBoss:    { speed: .82, tank: .09, timebank: .020 },
  RiverPolice:     { speed: 1.30, tank: .26, timebank: .080 }
};

function paceFor(nick){
  return PLAYER_PACE[nick] || { speed: 1, tank: .14, timebank: .035 };
}

function makeThinkPlan(engine, player, legal){
  const p = paceFor(player.nick);
  const street = engine.street || 'preflop';
  const facingBet = legal.toCall > 0;
  const potBB = legal.potBB || 0;
  const callBB = legal.toCallBB || 0;

  // База. Даже "инста" действие не происходит за 0.3 секунды.
  let lo = street === 'preflop' ? 1.8 : 2.6;
  let hi = street === 'preflop' ? 5.2 : 7.2;

  // Сложные решения естественно дольше.
  if(facingBet){ lo += 1.0; hi += 2.4; }
  if(callBB >= 5){ lo += .8; hi += 1.8; }
  if(potBB >= 18){ lo += .7; hi += 1.5; }
  if(street === 'turn'){ lo += .8; hi += 2.0; }
  if(street === 'river'){ lo += 1.5; hi += 3.4; }

  let seconds = rnd(lo, hi) * p.speed;
  let mode = 'normal';

  // Иногда человек просто сразу выкидывает/чекает.
  if(Math.random() < .18 && (!facingBet || callBB < 2.5)){
    seconds = rnd(1.15, 2.4);
    mode = 'snap';
  }

  // Иногда реально сидит думает.
  if(Math.random() < p.tank){
    seconds = rnd(street === 'preflop' ? 7.0 : 8.5, street === 'river' ? 15.5 : 13.0) * p.speed;
    mode = 'tank';
  }

  // Редкий time bank. Не каждую руку и не у всех одинаково.
  if(Math.random() < p.timebank && (facingBet || street === 'turn' || street === 'river')){
    seconds = rnd(14.0, 22.0);
    mode = 'timebank';
  }

  seconds = clamp(seconds, 1.1, 23);
  return {
    seconds,
    ms: Math.round(seconds * 1000),
    mode,
    baseSeconds: Math.min(10, Math.ceil(seconds)),
    timeBankSeconds: Math.max(0, Math.ceil(seconds - 10))
  };
}

/* ------------------------- HUMAN BOT PACING ------------------------- */

const originalBotAction = HoldemDemo.prototype.botAction;
HoldemDemo.prototype.botAction = async function(player, legal){
  // План создаёт controller в момент TURN_STARTED. Если его нет — создаём здесь.
  const plan = player.__humanThinkPlan || makeThinkPlan(this, player, legal);
  player.__humanThinkPlan = plan;

  // В оригинале уже была микропауза ~0.3 сек. Мы сами задаём человеческую,
  // поэтому временно убираем старый botDelay, чтобы не удваивать ожидание.
  await sleep(plan.ms);
  const oldDelay = this.botDelayMs;
  this.botDelayMs = 0;
  try{
    return await originalBotAction.call(this, player, legal);
  } finally {
    this.botDelayMs = oldDelay;
    player.__humanThinkPlan = null;
  }
};

// Пауза после выхода улицы, чтобы board не превращался в "видео на x2".
const originalBettingRound = HoldemDemo.prototype.bettingRound;
HoldemDemo.prototype.bettingRound = async function(startIndex){
  if(this.street === 'flop') await sleep(900);
  else if(this.street === 'turn') await sleep(1050);
  else if(this.street === 'river') await sleep(1200);
  return originalBettingRound.call(this, startIndex);
};

/* ------------------------- BOT TURN TIMER ------------------------- */

const originalStartTurnTimer = TableController.prototype.startTurnTimer;
TableController.prototype.startTurnTimer = function(e){
  if(e.nick === this.heroNick){
    return originalStartTurnTimer.call(this, e);
  }

  clearInterval(this.turnTimer);
  const seat = this.view.seats.get(e.seat);
  const player = this.engine.players[e.seat];
  if(!seat || !player) return;

  // legal нужен только для оценки сложности решения.
  let legal;
  try{ legal = this.engine.legalFor(player, true); }
  catch(_){ legal = {toCall:0,toCallBB:0,potBB:(this.engine.pot||0)/Math.max(1,this.engine.bb)}; }

  const plan = makeThinkPlan(this.engine, player, legal);
  player.__humanThinkPlan = plan;

  const started = Date.now();
  const deadline = started + plan.ms;
  seat.ring.style.setProperty('--turn-progress', '1');

  const status = this.root.querySelector('#v1TurnStatus');
  if(status) status.textContent = `${e.nick} думает…`;

  this.turnTimer = setInterval(()=>{
    const left = Math.max(0, (deadline - Date.now()) / 1000);
    seat.ring.style.setProperty('--turn-progress', String(clamp(left / plan.seconds, 0, 1)));

    if(status){
      if(plan.mode === 'timebank' && left <= Math.max(1, plan.seconds - 10)){
        status.textContent = `${e.nick} · TIME BANK ${Math.ceil(left)}s`;
        status.classList.add('bot-timebank');
      }else if(plan.mode === 'tank' && left <= Math.max(2, plan.seconds * .58)){
        status.textContent = `${e.nick} всё ещё думает… ${Math.ceil(left)}s`;
      }else{
        status.textContent = `${e.nick} думает… ${Math.ceil(left)}s`;
      }
    }

    if(left <= 0){
      clearInterval(this.turnTimer);
      if(status) status.classList.remove('bot-timebank');
    }
  }, 200);
};

/* ------------------------- BOARD DEAL ANIMATION ------------------------- */

const originalDealBoardCard = TableView.prototype.dealBoardCard;
TableView.prototype.dealBoardCard = function(e){
  const street = e.street || '';
  // На флопе три события прилетают подряд. Показываем карты с небольшим ритмом.
  if(street === 'flop'){
    const boardIndex = Number.isFinite(e.index) ? e.index : 0;
    const flopIndex = Math.max(0, Math.min(2, boardIndex));
    setTimeout(()=>originalDealBoardCard.call(this, e), flopIndex * 230);
    return;
  }
  setTimeout(()=>originalDealBoardCard.call(this, e), 180);
};

/* ------------------------- BET / RAISE SIZING UI ------------------------- */

function fmtBB(chips, bigBlind){
  const v = (Number(chips)||0) / Math.max(1, Number(bigBlind)||1);
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function injectSizingStyles(){
  if(document.getElementById('kataly-human-patch-style')) return;
  const style = document.createElement('style');
  style.id = 'kataly-human-patch-style';
  style.textContent = `
    .v1-controls{overflow:visible!important}
    .v1-main-actions{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:8px!important}
    .v1-main-actions button{min-height:52px!important}
    .v1-sizing-panel{
      margin-top:9px;padding:10px;border:1px solid rgba(255,255,255,.12);
      border-radius:14px;background:rgba(8,9,11,.96);box-shadow:0 12px 30px rgba(0,0,0,.35)
    }
    .v1-sizing-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .v1-sizing-head b{font-size:12px;letter-spacing:.08em}
    .v1-sizing-head span{font-size:11px;opacity:.62}
    .v1-sizing-presets{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}
    .v1-sizing-presets button,.v1-stepper button{
      flex:0 0 auto;border:1px solid rgba(255,255,255,.15);background:#17181d;color:#fff;
      border-radius:10px;min-height:38px;padding:0 12px;font-weight:800
    }
    .v1-sizing-presets button.active{border-color:#ff2f87;box-shadow:0 0 0 1px rgba(255,47,135,.35) inset}
    .v1-sizing-row{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;gap:8px;align-items:center;margin-top:5px}
    .v1-sizing-row button{border:0;border-radius:10px;background:#22242b;color:#fff;font-size:22px;min-height:42px}
    .v1-sizing-row input[type=range]{width:100%;accent-color:#ff2f87}
    .v1-sizing-value{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px}
    .v1-sizing-value input{
      min-width:0;background:#101116;border:1px solid rgba(255,255,255,.16);border-radius:11px;
      color:#fff;font-size:18px;font-weight:900;text-align:center;padding:10px
    }
    .v1-sizing-value .unit{display:grid;place-items:center;min-width:46px;border-radius:11px;background:#181920;font-weight:900}
    .v1-sizing-confirm{
      width:100%;margin-top:8px;min-height:48px;border:0;border-radius:12px;
      background:linear-gradient(135deg,#ff2f87,#8f44ff);color:#fff;font-weight:950;letter-spacing:.03em
    }
    .v1-sizing-confirm:disabled{opacity:.35}
    .v1-allin-btn{border-color:rgba(255,68,68,.6)!important;color:#ff7b7b!important}
    .v1-turn-status.bot-timebank{color:#ffcc55!important;text-shadow:0 0 14px rgba(255,204,85,.35)}
    @media (max-width:520px){
      .v1-sizing-panel{padding:8px;margin-top:7px}
      .v1-sizing-presets button{padding:0 10px;min-height:36px}
      .v1-main-actions button{min-height:48px!important;font-size:13px!important}
    }
  `;
  document.head.appendChild(style);
}
injectSizingStyles();

TableView.prototype.renderHeroControls = function(legal, onAction, street='preflop', extras={}){
  const c = this.root.querySelector('#v1Controls');
  if(!c) return;

  const bbChips = Math.max(1, Number(legal.bb)||1);
  const min = Number(legal.minRaise)||0;
  const max = Number(legal.maxRaise)||0;
  const toCall = Number(legal.toCall)||0;
  const currentBet = Number(legal.currentBet)||0;
  const pot = Number(legal.pot)||0;
  const canRaise = !!legal.canRaise && max > currentBet;
  const isBet = currentBet === 0;
  const step = Math.max(1, Math.round(bbChips/2)); // 0.5 BB

  let selected = clamp(
    isBet ? Math.round(pot * .5) : Math.max(min, Math.round(currentBet * 2.5)),
    min, max
  );
  selected = roundTo(selected, step);
  selected = clamp(selected, min, max);

  const callBB = fmtBB(toCall, bbChips);
  const minBB = fmtBB(min, bbChips);
  const maxBB = fmtBB(max, bbChips);

  const preflopPresets = [
    ['2×', () => currentBet > 0 ? currentBet*2 : bbChips*2],
    ['2.5×', () => currentBet > 0 ? currentBet*2.5 : bbChips*2.5],
    ['3×', () => currentBet > 0 ? currentBet*3 : bbChips*3],
    ['4×', () => currentBet > 0 ? currentBet*4 : bbChips*4]
  ];
  const postflopPresets = [
    ['25%', .25], ['33%', .33], ['50%', .50], ['66%', .66], ['75%', .75], ['POT', 1]
  ];

  const presets = street === 'preflop'
    ? preflopPresets.map((x,i)=>`<button type="button" data-pre="${i}">${x[0]}</button>`).join('')
    : postflopPresets.map(x=>`<button type="button" data-pot="${x[1]}">${x[0]}</button>`).join('');

  c.innerHTML = `
    <div class="v1-context">
      <span>POT ${fmtBB(pot,bbChips)} BB</span>
      <span>${legal.canCheck ? 'CHECK' : `TO CALL ${callBB} BB`}</span>
      <span>STACK ${Number(legal.stackBB||0).toFixed(1)} BB</span>
      <button id="v1TimeBank" class="v1-timebank-btn" ${(extras.timeBank||0)>0?'':'disabled'}>
        TIME BANK +10s · ${extras.timeBank||0}s
      </button>
    </div>

    <div class="v1-main-actions">
      <button data-action="fold" class="fold">FOLD</button>
      <button data-action="${legal.canCheck?'check':'call'}" class="call">
        ${legal.canCheck?'CHECK':`CALL ${callBB} BB`}
      </button>
      <button id="v1RaiseFocus" class="raise" ${canRaise?'':'disabled'}>
        ${isBet?'BET':'RAISE'} ${canRaise?fmtBB(selected,bbChips)+' BB':''}
      </button>
    </div>

    <div class="v1-sizing-panel" style="${canRaise?'':'display:none'}">
      <div class="v1-sizing-head">
        <b>${isBet?'РАЗМЕР СТАВКИ':'РАЗМЕР РЕЙЗА'}</b>
        <span>min ${minBB} · max ${maxBB} BB</span>
      </div>
      <div class="v1-sizing-presets">
        ${presets}
        <button type="button" class="v1-allin-btn" data-allin="1">ALL-IN</button>
      </div>
      <div class="v1-sizing-row">
        <button type="button" data-step="-1">−</button>
        <input id="v1SizingRange" type="range" min="${min}" max="${max}" step="${step}" value="${selected}">
        <button type="button" data-step="1">+</button>
      </div>
      <div class="v1-sizing-value">
        <input id="v1SizingBB" inputmode="decimal" type="number"
          min="${minBB}" max="${maxBB}" step="0.5" value="${fmtBB(selected,bbChips)}" aria-label="Размер в BB">
        <div class="unit">BB</div>
      </div>
      <button id="v1SizingConfirm" class="v1-sizing-confirm">
        ${isBet?'BET':'RAISE TO'} ${fmtBB(selected,bbChips)} BB
      </button>
    </div>
  `;

  const timeBank = c.querySelector('#v1TimeBank');
  if(timeBank && extras.onTimeBank) timeBank.onclick = ()=>extras.onTimeBank();

  c.querySelectorAll('[data-action]').forEach(btn=>{
    btn.onclick = ()=>onAction({type:btn.dataset.action});
  });

  if(!canRaise) return;

  const range = c.querySelector('#v1SizingRange');
  const input = c.querySelector('#v1SizingBB');
  const confirm = c.querySelector('#v1SizingConfirm');
  const raiseFocus = c.querySelector('#v1RaiseFocus');

  const setSelected = chips=>{
    selected = clamp(roundTo(Number(chips)||min, step), min, max);
    range.value = String(selected);
    input.value = fmtBB(selected, bbChips);
    const label = `${isBet?'BET':'RAISE TO'} ${fmtBB(selected,bbChips)} BB`;
    confirm.textContent = label;
    raiseFocus.textContent = `${isBet?'BET':'RAISE'} ${fmtBB(selected,bbChips)} BB`;
  };

  range.oninput = ()=>setSelected(Number(range.value));

  input.oninput = ()=>{
    const v = Number(String(input.value).replace(',', '.'));
    if(Number.isFinite(v)) setSelected(v * bbChips);
  };
  input.onblur = ()=>setSelected(selected);

  c.querySelectorAll('[data-step]').forEach(btn=>{
    btn.onclick = ()=>setSelected(selected + Number(btn.dataset.step)*step);
  });

  c.querySelectorAll('[data-pre]').forEach(btn=>{
    btn.onclick = ()=>{
      const item = preflopPresets[Number(btn.dataset.pre)];
      if(item) setSelected(item[1]());
    };
  });

  c.querySelectorAll('[data-pot]').forEach(btn=>{
    btn.onclick = ()=>{
      const fraction = Number(btn.dataset.pot);
      // Bet: % от текущего pot.
      // Raise: сначала call, затем % от банка после call.
      let target;
      if(isBet){
        target = pot * fraction;
      }else{
        const potAfterCall = pot + toCall;
        target = currentBet + toCall + potAfterCall * fraction;
      }
      setSelected(target);
    };
  });

  c.querySelector('[data-allin]').onclick = ()=>onAction({type:'allin'});
  confirm.onclick = ()=>onAction({type:'raise', amount:selected});

  // Большая кнопка RAISE/BET теперь не прячет сайзинг: она просто фокусирует поле.
  raiseFocus.onclick = ()=>{
    const panel = c.querySelector('.v1-sizing-panel');
    if(panel) panel.scrollIntoView({behavior:'smooth',block:'nearest'});
    input.focus();
    input.select();
  };

  setSelected(selected);
};

console.info('[KATALY] Human pacing + raise sizing patch v1.4 active');
