const RANK={2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function describeHand(hole=[]){
  if(hole.length<2)return{code:'--',strength:.5,pair:false,suited:false,gap:0,broadway:0};
  let a=RANK[hole[0][0]],b=RANK[hole[1][0]];
  const high=Math.max(a,b),low=Math.min(a,b),pair=high===low;
  const suited=hole[0][1]===hole[1][1],gap=high-low;
  const broadway=(high>=10?1:0)+(low>=10?1:0);
  const code=pair?`${hole[0][0]}${hole[1][0]}`:`${high===a?hole[0][0]:hole[1][0]}${high===a?hole[1][0]:hole[0][0]}${suited?'s':'o'}`;
  let strength;
  if(pair)strength=.43+(high/14)*.52;
  else{
    strength=(high/14)*.48+(low/14)*.22;
    if(suited)strength+=.07;
    if(gap===1)strength+=.055;else if(gap===2)strength+=.025;else if(gap>=5)strength-=.055;
    strength+=broadway*.035;
    if(high===14)strength+=.02;
  }
  return{code,strength:clamp(strength,.05,.99),pair,suited,gap,broadway,high,low};
}

export function openThreshold(position){
  return({UTG:.59,'UTG+1':.57,MP:.54,LJ:.52,HJ:.49,CO:.44,BTN:.39,'BTN/SB':.40,SB:.47,BB:.46})[position]||.52;
}

function raiseTarget(legal,multiplier){
  const target=Math.round(Math.max(legal.minRaise,Math.min(legal.maxRaise,Math.max(legal.bb*2.2,legal.currentBet*multiplier))));
  return target>=legal.maxRaise?{type:'allin'}:{type:'raise',amount:target};
}

export function decidePreflop({hole,position,legal,profile={},rng=Math.random}){
  const hand=describeHand(hole),stack=Number(legal.effectiveStackBB||legal.stackBB||0);
  const raises=Number(legal.preflopRaiseCount||0);
  const archetype=profile.archetype||'balanced';
  const loose=Number(profile.loose)||0,agg=Number(profile.agg)||0;
  const mistakeRate=clamp(Number(profile.mistakeRate)||.035,0,.22);
  const roll=rng();
  const unopened=raises===0;
  let threshold=openThreshold(position)-loose*.58;

  // Short-stack tournament poker: open-shove/fold becomes dominant.
  if(stack<=12){
    threshold-=(position==='BTN'||position==='SB'||position==='BTN/SB') ? .08 : 0;
    if(!unopened)threshold+=.12;
    if(hand.strength>=threshold){
      return{type:'allin',reason:`push/fold ${stack.toFixed(1)} BB · ${position} · ${hand.code}`,confidence:.88};
    }
    return{type:legal.canCheck?'check':'fold',reason:`ниже push/fold диапазона · ${hand.code}`,confidence:.86};
  }

  if(unopened){
    if(hand.strength>=threshold){
      const action=raiseTarget(legal,2.2);
      return{...action,reason:`open-range ${position} · ${hand.code}`,confidence:.82};
    }
    // Calling-station / chaotic recreational players sometimes limp marginal
    // playable hands. The mistake has a persona and a reason, not pure noise.
    if(!legal.canCheck&&hand.strength>=threshold-.09&&roll<mistakeRate+(archetype==='calling' ? .16 : (archetype==='chaotic' ? .10 : 0))){
      return{type:'call',reason:`персонажный limp · ${hand.code}`,confidence:.48,mistake:'loose-limp'};
    }
    return{type:legal.canCheck?'check':'fold',reason:`ниже open-range ${position} · ${hand.code}`,confidence:.80};
  }

  const facing=raises===1?'open':raises===2?'3-bet':'4-bet+';
  let continueThreshold=threshold+(raises===1 ? .13 : (raises===2 ? .24 : .31));
  if(stack<=20)continueThreshold-=.035;
  const premium=hand.strength>=continueThreshold+.12;
  const playable=hand.strength>=continueThreshold;

  if(premium&&legal.canRaise){
    if(stack<=22)return{type:'allin',reason:`value reshove ${stack.toFixed(1)} BB vs ${facing} · ${hand.code}`,confidence:.90};
    const action=raiseTarget(legal,position==='SB'||position==='BB'?3.5:3.0);
    return{...action,reason:`value ${raises+2}-bet vs ${facing} · ${hand.code}`,confidence:.88};
  }
  if(playable){
    if(legal.toCallBB>=stack*.28)return{type:'allin',reason:`короткий reshove vs ${facing} · ${hand.code}`,confidence:.78};
    return{type:'call',reason:`continue-range vs ${facing} · ${hand.code}`,confidence:.76};
  }

  // Explainable persona mistakes: sticky players overcall; aggro players can
  // make a light 3-bet. Both remain rare and reproducible through engine RNG.
  if(hand.strength>=continueThreshold-.10&&roll<mistakeRate){
    if(archetype==='calling')return{type:'call',reason:`слишком любопытный call vs ${facing} · ${hand.code}`,confidence:.40,mistake:'sticky-call'};
    if(archetype==='aggro'&&legal.canRaise){
      const action=raiseTarget(legal,3.0);
      return{...action,reason:`light aggression vs ${facing} · ${hand.code}`,confidence:.42,mistake:'light-raise'};
    }
  }
  return{type:'fold',reason:`fold-range vs ${facing} · ${hand.code}`,confidence:.84};
}
