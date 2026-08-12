
import { HoldemDemo } from './engine.js?v=114';
import { TableView } from './tableView.js?v=114';

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
    on('STREET_STARTED',e=>this.view.showWaiting(e.street.toUpperCase()));
    on('BOARD_CARD_DEALT',e=>this.view.dealBoardCard(e));
    on('SHOWDOWN_STARTED',()=>this.view.showWaiting('SHOWDOWN'));
    on('CARDS_REVEALED',e=>this.view.revealCards(e));
    on('POT_AWARDED',e=>this.view.showPotAward(e));
    on('HAND_FINISHED',e=>this.view.showHandResult(e.summary));
  }

  bindStatic(){
    this.root.querySelector('#v1Exit').onclick=()=>this.exit();
    this.root.querySelector('#v1Tournament').onclick=()=>alert('Tournament Info: уровень, блайнды и таймер уже отображаются сверху.');
  }

  startTurnTimer(e){
    clearInterval(this.turnTimer);
    const seat=this.view.seats.get(e.seat);
    if(!seat)return;
    let left=18;
    seat.ring.style.setProperty('--turn-progress','1');
    this.turnTimer=setInterval(()=>{
      left--;
      seat.ring.style.setProperty('--turn-progress',String(Math.max(0,left/18)));
      if(left<=0)clearInterval(this.turnTimer);
    },1000);
  }

  onHeroDecision(legal,resolve){
    this.pendingLegal=legal;this.pendingResolve=resolve;
    this.view.renderHeroControls(legal,action=>this.submitHero(action),this.lastSnapshot?.street||'preflop');
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
    },1400);
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
