
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
    const invoke=(set)=>{
      if(!set)return;
      // Один упавший UI-listener больше не может остановить весь poker engine.
      [...set].forEach(fn=>{
        try{ fn(event); }
        catch(err){ console.error('[KATALY event listener]',type,err); }
      });
    };
    invoke(this.listeners.get(type));
    invoke(this.listeners.get('*'));
    return event;
  }
  clear(){
    this.listeners.clear();
  }
}
