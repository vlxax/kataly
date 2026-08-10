
function id(){ return 'inv_'+Math.random().toString(36).slice(2,10); }
export function createInvite({from,to,seats,buyIn,format}){
  return {id:id(),direction:'out',from,to,seats,buyIn,format,status:'pending',createdAt:new Date().toISOString()};
}
export function mockIncomingInvite(){
  return {id:id(),direction:'in',from:'AK_Shooter',to:'Lera',seats:6,buyIn:1000,format:'NL Hold’em',status:'pending',createdAt:new Date().toISOString()};
}
