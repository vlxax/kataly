
export const SUITS = ['s','h','d','c'];
export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];

export function createDeck(){
  const out = [];
  for(let s=0; s<SUITS.length; s++){
    for(let r=0; r<RANKS.length; r++){
      out.push(RANKS[r] + SUITS[s]);
    }
  }
  return out;
}

export function shuffle(deck, rng=Math.random){
  const a = deck.slice();
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(rng() * (i+1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}
