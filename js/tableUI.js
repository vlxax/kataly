
import { TableController } from './poker/tableController.js?v=130';

export function mountPokerTable({lobby,heroNick,onExit,onSessionEnd}){
  const root=document.createElement('div');
  root.className='poker-room v1-room';
  document.body.appendChild(root);
  const controller=new TableController({root,lobby,heroNick,onExit,onSessionEnd});
  controller.start();
  return controller.engine;
}
