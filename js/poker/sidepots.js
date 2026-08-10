
export function buildSidePots(players){
  const contrib=players
    .filter(p=>Number(p.committed||0)>0)
    .map(p=>({seat:p.seat,amount:Number(p.committed||0),folded:!!p.folded}));
  const levels=[...new Set(contrib.map(x=>x.amount))].sort((a,b)=>a-b);
  const pots=[];let prev=0;
  for(const level of levels){
    const participants=contrib.filter(x=>x.amount>=level);
    const amount=(level-prev)*participants.length;
    if(amount>0){
      pots.push({
        amount,
        eligible:participants.filter(x=>!x.folded).map(x=>x.seat),
        contributors:participants.map(x=>x.seat)
      });
    }
    prev=level;
  }
  return pots;
}
