
export function prizePool({buyIn,seats}){ return buyIn*seats; }
export function defaultPayouts(seats){
  return seats===6 ? [0.60,0.25,0.15] : [0.50,0.30,0.20];
}
