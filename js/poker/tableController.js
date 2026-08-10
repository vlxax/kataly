
import { HoldemDemo } from './engine.js?v=160';
import { TableView } from './tableView.js?v=160';

export class TableController{
  constructor({root,lobby,heroNick,onExit,onSessionEnd}){
    this.root=root;this.lobby=lobby;this.heroNick=heroNick;this.onExit=onExit;this.onSessionEnd=onSessionEnd;
    this.cancelled=false;this.lastSnapshot=null;this.lastHand=null;this.pendingResolve=null;this.pendingLegal=null;this.turnTimer=null;
    const players=(lobby.players||[]).map(p=>({nick:p.nick,type:p.type||'bot',style:p.style||''}));
    this.view=new TableView({root,players,heroNick});
    this.engine=new HoldemDemo({
      players,heroNick,stackBB:lobby.stackBB||100,smallBlind:50,bigBlind:100,levelSeconds:300,
      bigBlindAnte:true,botDelayMs:700,eventPaceMs:170,
      onChange:s=>{this.lastSnapshot=s;this.view.lastBB=s.bb;this.view.updateSnapshot(s)},
      onHeroDecision:(legal,resolve)=>this.onHeroDecision(legal,resolve),
      onHandEnd:h=>this.onHandEnd(h),
      onTournamentEnd:r=>this.onTournamentEnd(r)
    });
    this.heroStart=(this.engine.hero()&&this.engine.hero().stack)||10000;
    this.heroStartBB=lobby.stackBB||100;
    this.bindEvents();
    this.bindStatic();
  }

  bindEvents(){
    const on=(type,fn)=>this.engine.on(type,fn);
    on('HAND_STARTED',()=>{this.view.clearHand();this.view.showWaiting('Раздаём карты…')});
    on('FORCED_BET',e=>this.view.postForcedBet(e));
    on('CARD_DEALT',e=>this.view.dealCard(e));
    on('TURN_STARTED',e=>{this.startTurnTimer(e);this.view.setTurn(e);if(e.nick!==this.heroNick)this.view.showWaiting(`${e.nick} думает…`)});
    on('PLAYER_FOLDED',e=>this.view.showPlayerAction('PLAYER_FOLDED',e));
    on('PLAYER_CHECKED',e=>this.view.showPlayerAction('PLAYER_CHECKED',e));
    on('PLAYER_CALLED',e=>this.view.showPlayerAction('PLAYER_CALLED',e));
    on('PLAYER_RAISED',e=>this.view.showPlayerAction('PLAYER_RAISED',e));
    on('PLAYER_ALLIN',e=>this.view.showPlayerAction('PLAYER_ALLIN',e));
    on('BETTING_ROUND_COMPLETE',async()=>{this.view.showWaiting('Собираем ставки…');await this.view.collectBets()});
    on('STREET_STARTED',e=>{
      const names={flop:'FLOP · открываем три карты',turn:'TURN · открываем карту',river:'RIVER · последняя карта'};
      this.view.showWaiting(names[e.street]||e.street.toUpperCase());
    });
    on('BOARD_CARD_DEALT',e=>this.view.dealBoardCard(e));
    on('SHOWDOWN_STARTED',()=>this.view.showWaiting('SHOWDOWN · вскрываем карты…'));
    on('CARDS_REVEALED',e=>this.view.revealCards(e));
    on('POT_AWARDED',e=>this.view.showPotAward(e));
    on('HAND_FINISHED',e=>this.view.showHandResult(e.summary));
  }

  bindStatic(){
    this.root.querySelector('#v1Exit').onclick=()=>this.exit();
    const historyBtn=this.root.querySelector('#v1History');
    if(historyBtn)historyBtn.onclick=()=>this.view.toggleHistory(this.lastSnapshot);
    const speedBtn=this.root.querySelector('#v1Speed');
    if(speedBtn){
      speedBtn.onclick=()=>{
        const modes=[['REG',1],['СПОКОЙНО',1.45],['УЧЕБА',1.9]];
        const cur=Number(localStorage.getItem('kataly_speed')||1.45);
        let idx=modes.findIndex(x=>x[1]===cur);idx=(idx+1)%modes.length;
        localStorage.setItem('kataly_speed',String(modes[idx][1]));
        speedBtn.textContent='⏱ '+modes[idx][0];
      };
    }
    this.root.querySelector('#v1Tournament').onclick=()=>{
      const s=this.lastSnapshot;if(!s)return;
      const old=this.root.querySelector('.v1-info-pop');if(old){old.remove();return;}
      const pop=document.createElement('div');pop.className='v1-info-pop';
      pop.innerHTML=`<b>КАТАЛЫ · 6-MAX MTT</b>
        <span>Level ${s.level} · ${Math.floor(s.levelRemaining/60)}:${String(s.levelRemaining%60).padStart(2,'0')}</span>
        <span>Blinds ${s.sb}/${s.bb} · BBA ${s.ante}</span>
        <span>Players ${s.activePlayers}/${s.totalPlayers}</span>
        <span>Average ${Math.round(s.averageStackBB*10)/10} BB</span>`;
      this.root.appendChild(pop);setTimeout(()=>pop.remove(),3500);
    };
  }

  startTurnTimer(e){
    clearInterval(this.turnTimer);
    const seat=this.view.seats.get(e.seat);
    if(!seat)return;
    let left=25;
    seat.ring.style.setProperty('--turn-progress','1');
    this.turnTimer=setInterval(()=>{
      left--;
      seat.ring.style.setProperty('--turn-progress',String(Math.max(0,left/25)));
      if(left<=0){
        clearInterval(this.turnTimer);
        if(e.nick===this.heroNick && this.pendingResolve && this.pendingLegal){
          this.submitHero({type:this.pendingLegal.canCheck?'check':'fold'});
        }
      }
    },1000);
  }

  onHeroDecision(legal,resolve){
    this.pendingLegal=legal;this.pendingResolve=resolve;
    this.view.renderHeroControls(legal,action=>this.submitHero(action),(this.lastSnapshot&&this.lastSnapshot.street)||'preflop');
  }

  submitHero(action){
    if(!this.pendingResolve)return;
    clearInterval(this.turnTimer);
    const r=this.pendingResolve;this.pendingResolve=null;this.pendingLegal=null;
    this.view.showWaiting('Ход принят');
    r(action);
  }

  onHandEnd(hand){
    this.lastHand=hand;
    setTimeout(()=>{
      if(!this.cancelled&&!this.engine.finished&&!this.engine.running)this.engine.startHand();
    },3200);
  }

  onTournamentEnd(result){
    this.view.showWaiting(`Турнир завершён · ${result.heroPlace} место`);
  }

  start(){
    this.engine.startHand().catch(err=>{
      console.error(err);this.view.showWaiting('Ошибка движка: '+err.message);
    });
  }

  exit(){
    if(this.cancelled)return;
    this.cancelled=true;
    if(this.pendingResolve){const r=this.pendingResolve;this.pendingResolve=null;r({type:'fold'});}
    clearInterval(this.turnTimer);this.engine.destroy();this.root.remove();if(this.onExit)this.onExit();
  }
}
