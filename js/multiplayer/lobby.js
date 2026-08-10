
export function createLobby({host,seats=6,format="NL Hold’em",buyIn=1000,stackBB=100,realPlayers=[]}){
  return {
    id:'lobby_'+Math.random().toString(36).slice(2,10),
    host,seats,format,buyIn,stackBB,
    realPlayers:[...new Set(realPlayers)],
    createdAt:new Date().toISOString()
  };
}
