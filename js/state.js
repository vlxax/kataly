const DEFAULT = {
  nick:'Lera',
  wallet:25000,
  view:'home',
  invites:[],
  history:[]
};

function cloneDefault(){
  return {
    nick: DEFAULT.nick,
    wallet: DEFAULT.wallet,
    view: DEFAULT.view,
    invites: [],
    history: []
  };
}

function loadSaved(){
  try {
    const raw = localStorage.getItem('kataly_v01');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('KATALY: damaged localStorage ignored', err);
    try { localStorage.removeItem('kataly_v01'); } catch (_) {}
    return {};
  }
}

export const state = Object.assign(cloneDefault(), loadSaved());
if (!Array.isArray(state.invites)) state.invites = [];
if (!Array.isArray(state.history)) state.history = [];
if (!['home','invites','history','stats'].includes(state.view)) state.view = 'home';
if (!Number.isFinite(Number(state.wallet))) state.wallet = DEFAULT.wallet;
state.wallet = Number(state.wallet);
if (!state.nick) state.nick = DEFAULT.nick;

export function saveState(){
  try { localStorage.setItem('kataly_v01', JSON.stringify(state)); }
  catch (err) { console.warn('KATALY: state save failed', err); }
}

export function resetDemo(){
  Object.keys(state).forEach(k=>delete state[k]);
  Object.assign(state, cloneDefault());
  saveState();
}
