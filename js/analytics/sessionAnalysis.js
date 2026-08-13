
const RV={2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};

function heroActions(hands,heroNick){
  return [].concat.apply([], hands.map(function(h){return h.actions.filter(function(a){return a.player===heroNick}).map(function(a){return Object.assign({},a,{hand:h})})}));
}
function preflopPower(cards=[]){
  if(cards.length<2)return .5;
  const a=RV[cards[0][0]],b=RV[cards[1][0]],pair=a===b,suited=cards[0][1]===cards[1][1];
  return Math.max(0,Math.min(1,(a+b)/30+(pair ? 0.25 : 0)+(suited ? 0.07 : 0)-(Math.abs(a-b) > 5 ? 0.08 : 0)));
}
function classify(a){
  let severity='good', score=86, title='Нормальное решение', reason='Линия выглядит логично для текущего банка и давления.';
  const pressure=a.toCallBB/Math.max(1,(a.stackAfterBB||0)+a.toCallBB);
  const pwr=preflopPower(a.heroHole);

  if(a.street==='preflop'){
    if(a.action==='call' && pwr<.36 && a.toCallBB>=2){severity='error';score=38;title='Лишний префлоп-колл';reason='Слабая стартовая рука продолжила против заметного рейза. Это раздувает VPIP и создаёт сложные постфлоп-споты.'}
    else if(a.action==='fold' && pwr>.78 && a.toCallBB<=4){severity='error';score=42;title='Слишком тайтовый фолд';reason='Сильная стартовая рука была выброшена против умеренного давления.'}
    else if(a.action==='raise' && pwr<.30){severity='warning';score=58;title='Слишком широкий рейз';reason='Агрессия сама по себе хороша, но эта комбинация слишком слаба для частого разгона банка.'}
    else if(a.action==='call' && pwr>.74){severity='warning';score=66;title='Пассивно с сильной рукой';reason='Сильную часть диапазона иногда стоит защищать рейзом, а не только коллом.'}
  } else {
    const pot=a.potBeforeBB||1;
    const sizing=a.amountBB/pot;
    if(a.action==='call' && pressure>.38){severity='warning';score=59;title='Дорогой колл';reason='Ты вложила большую долю оставшегося стека. Такие коллы требуют более сильного диапазона и хороших пот-оддсов.'}
    else if(a.action==='raise' && sizing>1.35){severity='warning';score=62;title='Очень крупный сайзинг';reason='Овербет может быть нормальным, но без сильной причины он делает диапазон дорогим и полярным.'}
    else if(a.action==='raise' && sizing<.22){severity='warning';score=64;title='Слишком маленький сайзинг';reason='Ставка даёт соперникам слишком комфортную цену и часто недобирает вэлью.'}
    else if(a.action==='fold' && a.toCallBB===0){severity='error';score=25;title='Невозможный фолд';reason='При нулевой цене решения должен быть check. Такой спот нужен для проверки логики движка.'}
  }
  return {...a,severity,score,title,reason};
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
  const errors=tagged.filter(a=>a.severity==='error');
  const warnings=tagged.filter(a=>a.severity==='warning');
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
    errors,warnings,good,tagged,stats,leaks
  };
}
