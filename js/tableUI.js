
import { HoldemDemo } from './poker/engine.js';

const suitSymbol={s:'♠',h:'♥',d:'♦',c:'♣'};
function cardHTML(c, hidden=false){
  if(hidden || !c || c==='XX') return `<div class="pcard back">✦</div>`;
  const r=c[0],s=c[1],red=s==='h'||s==='d';
  return `<div class="pcard ${red?'red':''}"><b>${r}</b><span>${suitSymbol[s]}</span></div>`;
}
function money(n){return Math.round(n*10)/10}

export function mountPokerTable({lobby, heroNick, onExit, onSessionEnd}){
  const root=document.createElement('div');root.className='game-screen';
  document.body.appendChild(root);
  const players=(lobby.players||[]).map(p=>({nick:p.nick,type:p.type||'bot',style:p.style||''}));
  let snapshot=null, resolveHero=null, lastHand=null, heroStart=0;

  const engine=new HoldemDemo({
    players,heroNick,stackBB:lobby.stackBB||100,smallBlind:1,bigBlind:2,
    onChange:s=>{snapshot=s;render()},
    onHeroDecision:(legal,resolve)=>{resolveHero=resolve;renderDecision(legal)},
    onHandEnd:hand=>{lastHand=hand;setTimeout(showHandResult,350)}
  });
  heroStart=engine.hero()?.stack||100;

  function seatPos(i,n){
    const maps={
      6:[[50,88],[16,70],[12,25],[50,8],[88,25],[84,70]],
      9:[[50,89],[23,81],[8,57],[11,25],[34,8],[66,8],[89,25],[92,57],[77,81]]
    };
    return (maps[n]||maps[6])[i]||[50,50];
  }
  function render(){
    if(!snapshot)return;
    root.innerHTML=`<div class="table-top">
      <button class="table-icon" id="leaveGame">×</button>
      <div><b>КАТАЛЫ</b><span>HAND #${snapshot.handNo} · ${lobby.seats}-MAX</span></div>
      <div class="table-pot">БАНК <b>${money(snapshot.pot)} BB</b></div>
    </div>
    <div class="felt-wrap">
      <div class="felt">
        <div class="board">${snapshot.board.map(c=>cardHTML(c)).join('')}</div>
        <div class="pot-chip">${snapshot.street.toUpperCase()}<b>${money(snapshot.pot)} BB</b></div>
      </div>
      ${snapshot.players.map((p,i)=>{
        const [x,y]=seatPos(i,snapshot.players.length);
        const hero=p.nick===heroNick;
        return `<div class="game-seat ${hero?'hero-seat':''} ${p.folded?'folded':''} ${p.out?'out':''}" style="left:${x}%;top:${y}%">
          <div class="seat-cards">${p.hole?.map(c=>cardHTML(c,c==='XX')).join('')||''}</div>
          <div class="seat-name">${p.nick}${hero?' · YOU':''}</div>
          <div class="seat-stack">${money(p.stack)} BB</div>
          ${i===snapshot.button?'<div class="dealer">D</div>':''}
        </div>`
      }).join('')}
    </div>
    <div class="hero-hand">
      <div class="hero-cards">${snapshot.heroHole.map(c=>cardHTML(c)).join('')}</div>
      <div><span>ТВОЯ РУКА</span><b>${snapshot.street==='waiting'?'—':snapshot.street.toUpperCase()}</b></div>
    </div>
    <div class="action-log">${snapshot.log.map(x=>`<div>${x}</div>`).join('')}</div>
    <div class="decision-area" id="decisionArea"><div class="waiting-copy">Боты думают…</div></div>`;
    root.querySelector('#leaveGame').onclick=()=>{if(confirm('Выйти из тестовой сессии?')){root.remove();onExit?.()}};
  }
  function renderDecision(legal){
    const area=root.querySelector('#decisionArea'); if(!area)return;
    const call=money(legal.toCall);
    area.innerHTML=`
      <div class="decision-main">
        <button class="poker-action fold" data-a="fold">FOLD</button>
        <button class="poker-action" data-a="${legal.canCheck?'check':'call'}">${legal.canCheck?'CHECK':'CALL '+call}</button>
        <button class="poker-action raise" id="raiseBtn">RAISE</button>
      </div>
      <div class="raise-row">
        <input id="raiseRange" type="range" min="${Math.max(legal.minRaise,legal.toCall+2)}" max="${Math.max(legal.minRaise,legal.stack)}" step="1" value="${Math.min(Math.max(legal.minRaise,legal.pot*.65),legal.stack)}">
        <span id="raiseValue"></span>
      </div>`;
    const range=area.querySelector('#raiseRange'), val=area.querySelector('#raiseValue');
    const sync=()=>val.textContent=`до ${money(+range.value)} BB`;sync();range.oninput=sync;
    area.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const r=resolveHero;resolveHero=null;area.innerHTML='<div class="waiting-copy">Ход принят</div>';r?.({type:b.dataset.a})});
    area.querySelector('#raiseBtn').onclick=()=>{const r=resolveHero;resolveHero=null;area.innerHTML='<div class="waiting-copy">Ход принят</div>';r?.({type:'raise',amount:+range.value})};
  }
  function showHandResult(){
    if(!lastHand)return;
    const heroWon=lastHand.winners.includes(heroNick);
    const overlay=document.createElement('div');overlay.className='hand-result';
    overlay.innerHTML=`<div class="hand-result-card">
      <div class="eyebrow">HAND #${lastHand.handNo}</div>
      <h2>${heroWon?'БАНК ТВОЙ':'РАЗДАЧА ЗАКОНЧЕНА'}</h2>
      <p>${lastHand.winners.join(', ')} · ${money(lastHand.pot)} BB</p>
      <div class="result-board">${lastHand.board.map(c=>cardHTML(c)).join('')}</div>
      <button class="btn btn-primary" id="nextHand">СЛЕДУЮЩАЯ РАЗДАЧА</button>
      <button class="btn btn-secondary" id="finishSession">ЗАКОНЧИТЬ СЕССИЮ</button>
    </div>`;
    root.appendChild(overlay);
    overlay.querySelector('#nextHand').onclick=()=>{overlay.remove();engine.startHand()};
    overlay.querySelector('#finishSession').onclick=()=>{
      const hero=engine.hero();
      const payload={hands:engine.handNo,actions:engine.handActions||[],stackStart:heroStart,stackEnd:hero?.stack||0,lastHand};
      overlay.remove();root.remove();onSessionEnd?.(payload);
    };
  }
  engine.startHand();
  return engine;
}
