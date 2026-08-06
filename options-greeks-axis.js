function readInputs(overrides={}){
  const spot=overrides.spot??toNumber(spotInput.value),rate=overrides.rate??toNumber(rateInput.value)/100,vol=overrides.vol??toNumber(volatilityInput.value)/100,multiplier=toNumber(multiplierInput.value);
  if(!(spot>0)||!Number.isFinite(rate)||!(vol>0)||!(multiplier>0))return null;
  const parsed=legs.map((leg,i)=>({kind:leg.kind,side:leg.side,qty:toNumber(leg.qty),strike:overrides.strikes?overrides.strikes[i]:toNumber(leg.strike),time:overrides.times?overrides.times[i]:(overrides.time??toNumber(leg.time)),vol,rate,dividend:toNumber(leg.dividend)/100}));
  if(!parsed.every(l=>Number.isFinite(l.qty)&&l.qty>0&&l.strike>0&&l.time>=0&&l.vol>0&&Number.isFinite(l.rate)&&Number.isFinite(l.dividend)))return null;
  return{spot,multiplier,legs:parsed};
}

function plotMetric(){
  const spot=toNumber(spotInput.value),axis=plotAxisInput.value,steps=120;if(!(spot>0)){Plotly.purge('plot');return}
  if(activeMetric==='payoff'){plotPayoff(spot);return}
  const x=[],y=[];
  if(axis==='spot'){const min=Math.max(.01,spot*.45),max=spot*1.55,tte=selectedTte();for(let i=0;i<=steps;i++){const level=min+(max-min)*i/steps,tot=calculatePortfolio({spot:level,time:tte});if(!tot)return Plotly.purge('plot');x.push(level);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs spot (TTE ${tte.toFixed(2)}y)`,'spot',spot)}
  else if(axis==='moneyness'){const min=.45,max=1.55,tte=selectedTte(),strikes=legs.map(l=>toNumber(l.strike));for(let i=0;i<=steps;i++){const m=min+(max-min)*i/steps,level=m*strikes[0],tot=calculatePortfolio({spot:level,time:tte});if(!tot)return Plotly.purge('plot');x.push(m);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs moneyness (TTE ${tte.toFixed(2)}y)`,'moneyness (S/K)',1)}
  else if(axis==='tau'){const maxTau=2,minTau=1/365;for(let i=0;i<=steps;i++){const tau=maxTau-(maxTau-minTau)*i/steps,tot=calculatePortfolio({time:tau});if(!tot)return Plotly.purge('plot');x.push(tau);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs tau`,'tau (years)',null)}
  else if(axis==='vol'){const currentVol=toNumber(volatilityInput.value),min=Math.max(.1,currentVol*.25),max=Math.max(min+.1,currentVol*2),tte=selectedTte();for(let i=0;i<=steps;i++){const vol=min+(max-min)*i/steps,tot=calculatePortfolio({vol:vol/100,time:tte});if(!tot)return Plotly.purge('plot');x.push(vol);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs implied vol (TTE ${tte.toFixed(2)}y)`,'implied vol (%)',currentVol)}
  else{const currentRate=toNumber(rateInput.value),min=currentRate-5,max=currentRate+5,tte=selectedTte();for(let i=0;i<=steps;i++){const rate=min+(max-min)*i/steps,tot=calculatePortfolio({rate:rate/100,time:tte});if(!tot)return Plotly.purge('plot');x.push(rate);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs rate (TTE ${tte.toFixed(2)}y)`,'rate (%)',currentRate)}
}