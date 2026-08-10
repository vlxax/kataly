
export class PokerEventBus {
  constructor(){
    this.listeners = new Map();
  }
  on(type, fn){
    if(!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn){
    const set = this.listeners.get(type);
    if(set) set.delete(fn);
  }
  emit(type, payload={}){
    const event = {type, ...payload, ts:Date.now()};
    const direct = this.listeners.get(type);
    if(direct) direct.forEach(fn => fn(event));
    const all = this.listeners.get('*');
    if(all) all.forEach(fn => fn(event));
    return event;
  }
  clear(){
    this.listeners.clear();
  }
}
