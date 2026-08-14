
import {describeHand} from '../poker/preflopStrategy.js?v=300';

const RV={2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};

function heroActions(hands,heroNick){
  return [].concat.apply([], hands.map(function(h){return h.actions.filter(function(a){return a.player===heroNick}).map(function(a){return Object.assign({},a,{hand:h})})}));
}
function preflopPower(cards=[]){
  return describeHand(cards).strength;
}
function classify(a){
  let severity='good',verdict='standard',confidence=.62,score=86,title='Стандартное решение',reason='По доступным данным линия выглядит логично для текущего банка и давления.';
  const pressure=a.toCallBB/Math.max(1,(a.stackAfterBB||0)+a.toCallBB);
  const pwr=preflopPower(a.heroHole);
  const hand=describeHand(a.heroHole);
  const context=a.preflopRaiseCount===0?'неоткрытый банк':a.preflopRaiseCount===1?'против открытия':a.preflopRaiseCount===2?'против 3-бета':'против 4-бета+';

  if(a.street==='preflop'){
    if(a.action==='call' && pwr<.34 && a.toCallBB>=2){severity='error';verdict='likely_error';confidence=.82;score=38;title='Вероятная ошибка: широкий префлоп-колл';reason=`${hand.code} продолжила ${context} за ${Math.round(a.toCallBB*10)/10} BB. Без специальных ридсов такая линия часто создаёт минусовые постфлоп-споты.`}
    else if(a.action==='fold' && pwr>.84 && a.toCallBB<=4){severity='error';verdict='likely_error';confidence=.86;score=42;title='Вероятная ошибка: слишком тайтовый фолд';reason=`${hand.code} относится к сильной части диапазона, а цена продолжения была умеренной. Точный вывод всё ещё зависит от экшена и диапазона соперника.`}
    else if((a.action==='raise'||a.action==='allin') && pwr<.32){severity='warning';verdict='questionable';confidence=.60;score=58;title='Спорное решение: очень широкая агрессия';reason=`${hand.code} выглядит слабой для частого рейза (${context}, ${a.position||'позиция не записана'}). Это может быть эксплойтом, поэтому решение не помечено как доказанная ошибка.`}
    else if(a.action==='call' && pwr>.78){severity='warning';verdict='questionable';confidence=.58;score=66;title='Спорное решение: пассивно с сильной рукой';reason=`${hand.code} часто может играть агрессивнее. Колл допустим как trap или mixed strategy, поэтому уверенность оценки ограничена.`}
    else if((a.effectiveStackBeforeBB||a.effectiveStackBB||99)<=12&&a.action==='raise'){severity='warning';verdict='questionable';confidence=.72;score=61;title='Спорное решение: маленький рейз с коротким стеком';reason='При эффективном стеке около 12 BB стратегию обычно стоит сравнить с push/fold. Нужна дополнительная проверка диапазона и стадии турнира.'}
  } else {
    const pot=a.potBeforeBB||1;
    const sizing=a.amountBB/pot;
    if(a.action==='call' && pressure>.38){severity='warning';verdict='questionable';confidence=.57;score=59;title='Спорное решение: дорогой колл';reason='Вложена большая доля оставшегося стека. Без оценки диапазона и equity это сигнал для разбора, а не доказанная ошибка.'}
    else if(a.action==='raise' && sizing>1.35){severity='warning';verdict='questionable';confidence=.52;score=62;title='Спорное решение: крупный овербет';reason='Овербет может быть правильным для полярного диапазона. Текущая эвристика лишь отмечает нестандартный размер.'}
    else if(a.action==='raise' && sizing<.22){severity='warning';verdict='questionable';confidence=.63;score=64;title='Спорное решение: очень маленький сайзинг';reason='Ставка даёт соперникам хорошую цену, но может быть допустима на подходящей текстуре борда.'}
    else if(a.action==='fold' && a.toCallBB===0){severity='error';verdict='confirmed_error';confidence=.99;score=25;title='Ошибка протокола: фолд при бесплатном check';reason='При нулевой цене доступен check. Это не стратегическая оценка, а проверяемая ошибка игровой логики.'}
  }
  const confidenceLabel=confidence>=.85?'ВЫСОКАЯ':confidence>=.65?'СРЕДНЯЯ':'ОГРАНИЧЕННАЯ';
  return {...a,severity,verdict,confidence,confidenceLabel,score,title,reason};
}
export function analyzeSession({hands=[],heroNick}){
  const actions=heroActions(hands,heroNick);
  const tagged=actions.map(classify);
  const byStreet={preflop:[],flop:[],turn:[],river:[]};
  tagged.forEach(a=>{if(byStreet[a.street])byStreet[a.street].push(a)});
  const avg=arr=>arr.length?Math.round(arr.reduce((s,x)=>s+x.score,0)/arr.length):null;
  const preflop=avg(byStreet.preflop), post=avg([...byStreet.flop,...byStreet.turn,...byStreet.river]);
  const sizingActs=tagged.filter(a=>a.action==='raise');
  const sizing=avg(sizingActs);
  const errors=tagged.filter(a=>a.verdict==='confirmed_error'||a.verdict==='likely_error');
  const warnings=tagged.filter(a=>a.verdict==='questionable');
  const good=tagged.filter(a=>a.severity==='good');
  const overall=avg(tagged)||0;

  const pf=byStreet.preflop;
  const handGroups=new Map();
  pf.forEach(a=>{if(!handGroups.has(a.handNo))handGroups.set(a.handNo,[]);handGroups.get(a.handNo).push(a)});
  const pfHands=[...handGroups.values()];
  const voluntary=pfHands.filter(xs=>xs.some(a=>['call','raise','allin'].includes(a.action))).length;
  const raises=pfHands.filter(xs=>xs.some(a=>a.action==='raise'||a.action==='allin')).length;
  const threeBets=pfHands.filter(xs=>xs.some(a=>(a.action==='raise'||a.action==='allin')&&a.currentBetBB>1)).length;
  const stats={
    decisions:tagged.length,
    vpip:pfHands.length?Math.round(voluntary/pfHands.length*100):0,
    pfr:pfHands.length?Math.round(raises/pfHands.length*100):0,
    threeBet:pfHands.length?Math.round(threeBets/pfHands.length*100):0
  };

  const leaks=[];
  const looseCalls=tagged.filter(a=>a.title==='Лишний префлоп-колл').length;
  const bigCalls=tagged.filter(a=>a.title==='Дорогой колл').length;
  const sizingIssues=tagged.filter(a=>a.title.includes('сайзинг')).length;
  if(looseCalls) leaks.push({title:'Слишком широкий префлоп-колл',count:looseCalls,status:'НОВЫЙ',trend:'↓',text:'Заходишь в банки с руками, которые слишком часто создают минусовые продолжения.'});
  if(bigCalls) leaks.push({title:'Любопытные дорогие коллы',count:bigCalls,status:'В РАБОТУ',trend:'↓',text:'Когда цена решения становится большой, дисциплина начинает проседать.'});
  if(sizingIssues) leaks.push({title:'Сайзинги требуют калибровки',count:sizingIssues,status:'НОВЫЙ',trend:'→',text:'Есть ставки, которые заметно выбиваются из размера банка.'});

  return {
    overall,preflop,postflop:post,sizing,
    discipline:Math.max(0,Math.round(100-(errors.length*18+warnings.length*6))),
    errors,warnings,good,tagged,stats,leaks,
    method:{kind:'heuristic',solver:false,label:'Эвристический разбор',notice:'Это не GTO-solver: выводы зависят от полноты записанного контекста и показывают уверенность оценки.'}
  };
}
