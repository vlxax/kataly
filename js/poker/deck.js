
export const SUITS=['s','h','d','c'];
export const RANKS=['2','3','4','5','6','7','8','9','T','J','Q','K','A'];

export function createDeck(){
  return SUITS.flatMap(s=>RANKS.map(r=>r+s));
}
export function shuffle(deck){
  const a=[...deck];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
