
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
  let snapshot=null, resolveHero=null, lastHand=null, heroStart=0, tournamentResult=null, ending=false;

  const engine=new HoldemDemo({
    players,heroNick,stackBB:lobby.stackBB||100,smallBlind:1,bigBlind:2,
    blindSchedule:[
      {sb:1,bb:2},{sb:2,bb:4},{sb:3,bb:6},{sb:5,bb:10},{sb:8,bb:16},{sb:12,bb:24},{sb:20,bb:40}
    ],
    handsPerLevel:3,
    onChange:s=>{snapshot=s;render()},
    onHeroDecision:(legal,resolve)=>{resolveHero=resolve;renderDecision(legal)},
    onHandEnd:hand=>{lastHand=hand;setTimeout(()=>{if(!ending)showHandResult()},300)},
    onTournamentEnd:r=>{tournamentResult=r;ending=true;setTimeout(showTournamentResult,380)}
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
      <div><b>КАТАЛЫ</b><span>HAND #${snapshot.handNo} · УРОВЕНЬ ${snapshot.level} · ${snapshot.activePlayers}/${snapshot.totalPlayers} В ИГРЕ</span></div>
      <div class="table-pot">БЛАЙНДЫ ${snapshot.sb}/${snapshot.bb}<b>БАНК ${money(snapshot.pot)}</b></div>
    </div>
    <div class="felt-wrap">
      <div class="felt">
        <div class="board">${snapshot.board.map(c=>cardHTML(c)).join('')}</div>
        <div class="pot-chip">${snapshot.street.toUpperCase()}<b>${money(snapshot.pot)}</b></div>
      </div>
      ${snapshot.players.map((p,i)=>{
        const [x,y]=seatPos(i,snapshot.players.length);
        const hero=p.nick===heroNick;
        return `<div class="game-seat ${hero?'hero-seat':''} ${p.folded?'folded':''} ${p.out?'out':''}" style="left:${x}%;top:${y}%">
          <div class="seat-cards">${p.hole?.map(c=>cardHTML(c,c==='XX')).join('')||''}</div>
          <div class="seat-name">${p.nick}${hero?' · YOU':''}</div>
          <div class="seat-stack">${money(p.stack)} фиш.</div>
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
    if(!lastHand || ending)return;
    const heroWon=lastHand.winners.includes(heroNick);
    const overlay=document.createElement('div');overlay.className='hand-result';
    const outs=lastHand.newlyOut||[];
    overlay.innerHTML=`<div class="hand-result-card">
      <div class="eyebrow">HAND #${lastHand.handNo} · УРОВЕНЬ ${lastHand.level}</div>
      <h2>${heroWon?'БАНК ТВОЙ':'РАЗДАЧА ЗАКОНЧЕНА'}</h2>
      <p>${lastHand.winners.join(', ')} · банк ${money(lastHand.pot)}</p>
      ${outs.length?`<div class="bust-line">${outs.map(x=>`${x.nick} вылетает · ${x.place} место`).join('<br>')}</div>`:''}
      <div class="result-board">${lastHand.board.map(c=>cardHTML(c)).join('')}</div>
      <div class="level-strip"><span>Сейчас ${lastHand.sb}/${lastHand.bb}</span><b>Новые блайнды каждые 3 руки</b></div>
      <button class="btn btn-primary" id="nextHand">СЛЕДУЮЩАЯ РАЗДАЧА</button>
      <button class="btn btn-secondary" id="finishSession">ЗАВЕРШИТЬ РАНЬШЕ</button>
    </div>`;
    root.appendChild(overlay);
    overlay.querySelector('#nextHand').onclick=()=>{overlay.remove();engine.startHand()};
    overlay.querySelector('#finishSession').onclick=()=>{
      const hero=engine.hero();
      const live=engine.active().length;
      tournamentResult={heroPlace:hero?.out?(engine.eliminations.find(x=>x.nick===heroNick)?.place||live+1):live,totalPlayers:engine.players.length,winner:null,earlyExit:true};
      overlay.remove();showTournamentResult();
    };
  }

  function payoutFor(place,total,buyIn){
    const pool=buyIn*total;
    const six=[.60,.25,.15], nine=[.50,.30,.20];
    const p=(total<=6?six:nine)[place-1]||0;
    return Math.round(pool*p);
  }

  function showTournamentResult(){
    if(!tournamentResult)return;
    document.querySelector('.hand-result')?.remove();
    const hero=engine.hero();
    const place=tournamentResult.heroPlace||engine.active().length;
    const prize=payoutFor(place,engine.players.length,lobby.buyIn);
    const overlay=document.createElement('div');overlay.className='hand-result tournament-result';
    overlay.innerHTML=`<div class="hand-result-card">
      <div class="eyebrow">ТУРНИР ЗАВЕРШЁН</div>
      <div class="place-medal">${place===1?'🏆':place===2?'🥈':place===3?'🥉':'#'+place}</div>
      <h2>${place===1?'КАТАЛ ЗАКРЫЛ ТУРНИР':`${place} МЕСТО`}</h2>
      <p>${engine.handNo} рук · финальные блайнды ${engine.sb}/${engine.bb}</p>
      <div class="tournament-summary">
        <div><span>ПРИЗ</span><b>${prize.toLocaleString('ru-RU')} 🪙</b></div>
        <div><span>ФИНИШНЫЙ СТЕК</span><b>${money(hero?.stack||0)}</b></div>
        <div><span>ИГРОКОВ</span><b>${engine.players.length}</b></div>
        <div><span>ВЫЛЕТОВ ДО ФИНИША</span><b>${engine.eliminations.length}</b></div>
      </div>
      <div class="freak-result">${place<=3?'Фриковая Дама: «Ну вот. Иногда кнопки нажимаются не только из любопытства.»':'Фриковая Дама: «Ничего. Зато теперь у Poker Brain есть улики.»'}</div>
      <button class="btn btn-primary" id="finishTournament">СМОТРЕТЬ РАЗБОР</button>
    </div>`;
    root.appendChild(overlay);
    overlay.querySelector('#finishTournament').onclick=()=>{
      const payload={
        hands:engine.handNo,
        handHistory:[...(engine.sessionHands||[])],
        actions:(engine.sessionHands||[]).flatMap(h=>h.actions||[]),
        stackStart:heroStart,
        stackEnd:hero?.stack||0,
        lastHand,
        tournament:{
          ...tournamentResult,
          prize,
          eliminations:[...(engine.eliminations||[])],
          finalSB:engine.sb,finalBB:engine.bb
        }
      };
      overlay.remove();root.remove();onSessionEnd?.(payload);
    };
  }
  engine.startHand();
  return engine;
}
