
export function createSessionRecord(lobby){
  return {
    id:'session_'+Math.random().toString(36).slice(2,10),
    createdAt:new Date().toISOString(),
    format:lobby.format,
    seats:lobby.seats,
    buyIn:lobby.buyIn,
    stackBB:lobby.stackBB,
    playerCount:(lobby.players && lobby.players.length) || lobby.seats,
    status:'engine_pending',
    hands:[],
    actions:[]
  };
}
export function recordAction(session, action){
  session.actions.push({
    ts:Date.now(),
    street:action.street,
    position:action.position,
    stackBB:action.stackBB,
    potBB:action.potBB,
    action:action.action,
    amountBB:action.amountBB != null ? action.amountBB : null,
    responseMs:action.responseMs != null ? action.responseMs : null
  });
}
