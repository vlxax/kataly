import { HoldemDemo } from './engine.js?v=130';
import { TableView } from './tableView.js?v=130';
import { analyzeSession } from '../analytics/sessionAnalysis.js?v=130';

export class TableController{
  constructor({root,lobby,heroNick,onExit,onSessionEnd}){
    this.root=root;this.lobby=lobby;this.heroNick=heroNick;this.onExit=onExit;this.onSessionEnd=onSessionEnd;
    this.cancelled=false;this.sessionClosed=false;this.lastSnapshot=null;this.lastHand=null;
    this.pendingResolve=null;this.pendingLegal=null;this.turnTimer=null;
    this.heroBaseSeconds=15;this.heroTimeBank=30;this.heroDeadline=0;this.heroSitOut=false;
    const players=(lobby.players||[]).map(p=>({nick:p.nick,type:p.type||'bot',style:p.style||''}));
    this.view=new TableView({root,players,heroNick});
    this.engine=new HoldemDemo({
      players,heroNick,stackBB:lobby.stackBB||100,smallBlind:50,bigBlind:100,levelSeconds:120,
      bigBlindAnte:true,botDelayMs:320,eventPaceMs:100,sessionSeconds:lobby.sessionSeconds||600,
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
    on('HAND_STARTED',e=>{
      this.view.clearHand();
      this.view.setHeroControlsIdle('Ждём твоего хода');
      this.view.logAction({kind:'street',text:`HAND #${e.handNo}`});
    });
    on('FORCED_BET',e=>{this.view.postForcedBet(e);this.view.logAction({street:e.street,nick:e.nick,text:`${e.label} ${this.toBB(e.amount)} BB`})});
    on('CARD_DEALT',e=>this.view.dealCard(e));
    on('TURN_STARTED',e=>{this.startTurnTimer(e);this.view.setTurn(e)});
    on('PLAYER_FOLDED',e=>{this.view.showPlayerAction('PLAYER_FOLDED',e);this.logPlayer(e,'FOLD')});
    on('PLAYER_CHECKED',e=>{this.view.showPlayerAction('PLAYER_CHECKED',e);this.logPlayer(e,'CHECK')});
    on('PLAYER_CALLED',e=>{this.view.showPlayerAction('PLAYER_CALLED',e);this.logPlayer(e,`CALL ${this.toBB(e.amount)} BB`)});
    on('PLAYER_RAISED',e=>{this.view.showPlayerAction('PLAYER_RAISED',e);this.logPlayer(e,`RAISE TO ${this.toBB(e.bet)} BB`)});
    on('PLAYER_ALLIN',e=>{this.view.showPlayerAction('PLAYER_ALLIN',e);this.logPlayer(e,`ALL-IN ${this.toBB(e.bet)} BB`)});
    on('BETTING_ROUND_COMPLETE',async()=>{await this.view.collectBets()});
    on('STREET_STARTED',e=>{this.view.setHeroControlsIdle('Ждём твоего хода');this.view.logAction({kind:'street',text:e.street.toUpperCase()})});
    on('BOARD_CARD_DEALT',e=>this.view.dealBoardCard(e));
    on('SHOWDOWN_STARTED',()=>{this.view.setHeroControlsIdle('SHOWDOWN');this.view.logAction({kind:'street',text:'SHOWDOWN'})});
    on('CARDS_REVEALED',e=>this.view.revealCards(e));
    on('POT_AWARDED',e=>{this.view.showPotAward(e);this.view.logAction({kind:'win',text:`${e.winners.join(', ')} +${this.toBB(e.amount)} BB · ${e.label||''}`})});
    on('HAND_FINISHED',e=>{
      const review=analyzeSession({hands:[e.summary],heroNick:this.heroNick});
      this.view.showHandResult(e.summary,review);
    });
    on('LEVEL_CHANGED',e=>this.view.logAction({kind:'street',text:`LEVEL ${e.level} · ${e.sb}/${e.bb}/${e.ante}` }));
  }

  bindStatic(){
    this.root.querySelector('#v1Exit').onclick=()=>this.exit();
    this.root.querySelector('#v1Tournament').onclick=()=>this.view.toggleTournamentPanel();
    const history=this.root.querySelector('#v1History');
    if(history)history.onclick=()=>this.view.toggleHistory();
    const sitout=this.root.querySelector('#v1SitOut');
    if(sitout)sitout.onclick=()=>{
      this.heroSitOut=!this.heroSitOut;
      this.view.setSitOut(this.heroSitOut);
      if(this.heroSitOut&&this.pendingResolve){
        this.submitHero({type:this.pendingLegal&&this.pendingLegal.canCheck?'check':'fold',sitOut:true});
      }
    };
  }

  toBB(chips){
    const big=(this.lastSnapshot&&this.lastSnapshot.bb)||this.engine.bb||100;
    const x=(Number(chips)||0)/Math.max(1,big);
    return (Math.round(x*10)/10).toFixed(x<10?1:0);
  }

  logPlayer(e,text){this.view.logAction({street:e.street,nick:e.nick,text});}

  startTurnTimer(e){
    clearInterval(this.turnTimer);
    const seat=this.view.seats.get(e.seat);
    if(!seat)return;
    const hero=e.nick===this.heroNick;
    let duration=this.heroBaseSeconds;
    if(!hero){const p=this.engine.players[e.seat],legal=(()=>{try{return this.engine.legalFor(p,true)}catch(_){return{toCall:0,toCallBB:0,potBB:0}}})();const maker=window.__KATALY_PACE_PLAN__;const plan=maker?maker(this.engine,p,legal):{seconds:4,mode:'normal'};p.__humanThinkPlan=plan;duration=plan.seconds;this.view.setBotThinking(e.seat,plan);}
    this.heroDeadline=Date.now()+duration*1000;
    const total=duration;
    seat.ring.style.setProperty('--turn-progress','1');
    this.turnTimer=setInterval(()=>{
      const left=Math.max(0,(this.heroDeadline-Date.now())/1000);
      seat.ring.style.setProperty('--turn-progress',String(Math.max(0,left/total)));
      if(hero)this.view.updateDecisionClock(Math.ceil(left),this.heroTimeBank);else this.view.updateBotThinking(e.seat,Math.ceil(left));
      if(left<=0){
        if(hero&&this.pendingResolve){
          if(this.heroTimeBank>0){
            const use=Math.min(10,this.heroTimeBank);
            this.heroTimeBank-=use;
            this.heroDeadline=Date.now()+use*1000;
            this.view.flashTimeBank(use,this.heroTimeBank);
            return;
          }
          this.submitHero({type:this.pendingLegal&&this.pendingLegal.canCheck?'check':'fold',timedOut:true});
        }
        clearInterval(this.turnTimer);if(!hero)this.view.clearBotThinking(e.seat);
      }
    },250);
  }

  useTimeBank(){
    if(!this.pendingResolve||this.heroTimeBank<=0)return;
    const use=Math.min(10,this.heroTimeBank);
    this.heroTimeBank-=use;
    this.heroDeadline=Math.max(Date.now(),this.heroDeadline)+use*1000;
    this.view.flashTimeBank(use,this.heroTimeBank);
  }

  onHeroDecision(legal,resolve){
    this.pendingLegal=legal;this.pendingResolve=resolve;
    const street=(this.lastSnapshot&&this.lastSnapshot.street)||'preflop';
    if(this.heroSitOut){
      setTimeout(()=>this.submitHero({type:legal.canCheck?'check':'fold',sitOut:true}),120);
      return;
    }
    this.view.renderHeroControls(
      legal,
      action=>this.submitHero(action),
      street,
      {timeBank:this.heroTimeBank,onTimeBank:()=>this.useTimeBank()}
    );
    this.view.updateDecisionClock(this.heroBaseSeconds,this.heroTimeBank);
  }

  submitHero(action){
    if(!this.pendingResolve)return;
    clearInterval(this.turnTimer);
    const r=this.pendingResolve;this.pendingResolve=null;this.pendingLegal=null;
    this.view.setHeroControlsIdle(action&&action.timedOut?'Время вышло · автоход':'Ход принят');
    r(action);
  }

  onHandEnd(hand){
    this.lastHand=hand;
    setTimeout(()=>{
      if(!this.cancelled&&!this.engine.finished&&!this.engine.running)this.engine.startHand();
    },2200);
  }

  payoutFor(place){
    const seats=(this.lobby.players&&this.lobby.players.length)||this.lobby.seats||6;
    const pool=(Number(this.lobby.buyIn)||0)*seats;
    let pct=0;
    if(seats>=6)pct=place===1?.50:place===2?.30:place===3?.20:0;
    else if(seats>=4)pct=place===1?.65:place===2?.35:0;
    else pct=place===1?1:0;
    return Math.round(pool*pct);
  }

  onTournamentEnd(result){
    this.view.setHeroControlsIdle(`Турнир завершён · ${result.heroPlace} место`);
    this.view.showTournamentEnd(result,this.payoutFor(result.heroPlace));
    if(this.sessionClosed)return;
    this.sessionClosed=true;
    const hero=this.engine.hero();
    const stackEnd=hero?hero.stack:0;
    const handHistory=this.engine.sessionHands.slice();
    const actions=[];
    handHistory.forEach(h=>(h.actions||[]).forEach(a=>actions.push(a)));
    const handsWon=handHistory.filter(h=>(h.winners||[]).includes(this.heroNick)).length;
    const biggestPot=handHistory.reduce((m,h)=>Math.max(m,Number(h.pot)||0),0);
    const payload={
      hands:handHistory.length,handsWon,handsLost:Math.max(0,handHistory.length-handsWon),biggestPotBB:biggestPot/Math.max(1,this.engine.baseBB),
      stackStart:this.heroStart,
      stackEnd,
      stackStartBB:this.heroStart/this.engine.baseBB,
      stackEndBB:stackEnd/Math.max(1,this.engine.bb),
      chipDeltaBB:(stackEnd-this.heroStart)/this.engine.baseBB,
      lastHand:this.lastHand,
      handHistory,
      actions,
      tournament:{...result,prize:this.payoutFor(result.heroPlace)}
    };
    setTimeout(()=>{
      if(this.cancelled)return;
      this.cancelled=true;
      this.root.remove();
      if(this.onSessionEnd)this.onSessionEnd(payload);
    },2200);
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
