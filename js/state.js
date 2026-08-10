
const DEFAULT = {
  nick:'Lera',
  wallet:25000,
  view:'home',
  invites:[],
  history:[]
};
export const state = Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem('kataly_v01')||'{}'));
export function saveState(){ localStorage.setItem('kataly_v01', JSON.stringify(state)); }
export function resetDemo(){
  Object.keys(state).forEach(k=>delete state[k]);
  Object.assign(state, structuredClone(DEFAULT));
  saveState();
}
