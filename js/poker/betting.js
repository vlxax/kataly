export const ACTIONS=['fold','check','call','raise','allin'];
export function potPercentTarget({pot,currentBet,playerBet,percent}){return Math.round(playerBet + Math.max(0,currentBet-playerBet) + pot*percent)}
