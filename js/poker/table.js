
export class PokerTable {
  constructor({seats=6,smallBlind=0.5,bigBlind=1,startingStackBB=100}={}){
    this.seats=seats;
    this.smallBlind=smallBlind;
    this.bigBlind=bigBlind;
    this.startingStackBB=startingStackBB;
    this.players=[];
    this.status='waiting';
  }
  addPlayer(player){
    if(this.players.length>=this.seats) throw new Error('TABLE_FULL');
    this.players.push({...player});
  }
}
