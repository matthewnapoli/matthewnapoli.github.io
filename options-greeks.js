const metrics=['cost','delta','gamma','vega','theta','rho','volga','vanna'];
const metricLayout=[['cost','delta','gamma'],['vega','theta','rho'],['volga','vanna']];
const $=id=>document.getElementById(id);
const legsElement=$('legs'),summaryElement=$('summary'),invalidElement=$('invalid');
const spotInput=$('spot'),rateInput=$('rate'),volatilityInput=$('volatility'),multiplierInput=$('multiplier');
const plotPayoffButton=$('plot-payoff'),plotAxisInput=$('plot-axis'),asOfInput=$('as-of-date'),tteSlider=$('tte-slider'),tteOutput=$('tte-output'),tteControl=$('tte-control');
let activeMetric='delta';
let legs=[{kind:'call',side:'buy',qty:1,strike:100,time:.5,dividend:0}];

function normPdf(x){return Math.exp(-.5*x*x)/Math.sqrt(2*Math.PI)}
function normCdf(x){const sign=x<0?-1:1,a=Math.abs(x)/Math.sqrt(2),t=1/(1+.3275911*a);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a);return .5*(1+sign*y)}
function blackScholes(kind,spot,strike,time,rate,vol,dividend){
  time=Math.max(time,1e-8);const rt=Math.sqrt(time),d1=(Math.log(spot/strike)+(rate-dividend+.5*vol*vol)*time)/(vol*rt),d2=d1-vol*rt;
  const sd=Math.exp(-dividend*time),kd=Math.exp(-rate*time),ds=spot*sd,dk=strike*kd,pdf=normPdf(d1),vega=spot*sd*pdf*rt;let price,delta,theta,rho;
  if(kind==='call'){price=ds*normCdf(d1)-dk*normCdf(d2);delta=sd*normCdf(d1);theta=-(spot*sd*pdf*vol)/(2*rt)-rate*strike*kd*normCdf(d2)+dividend*spot*sd*normCdf(d1);rho=strike*time*kd*normCdf(d2)}
  else{price=dk*normCdf(-d2)-ds*normCdf(-d1);delta=sd*(normCdf(d1)-1);theta=-(spot*sd*pdf*vol)/(2*rt)+rate*strike*kd*normCdf(-d2)-dividend*spot*sd*normCdf(-d1);rho=-strike*time*kd*normCdf(-d2)}
  return{cost:price,delta,gamma:sd*pdf/(spot*vol*rt),vega,theta,rho,volga:vega*d1*d2/vol,vanna:-sd*pdf*d2/vol};
}
function toNumber(v){return v===''?NaN:Number(v)}
function selectedTte(){return Math.max(0,toNumber(tteSlider.value))}
function readInputs(overrides={}){
  const spot=overrides.spot??toNumber(spotInput.value),rate=toNumber(rateInput.value)/100,vol=toNumber(volatilityInput.value)/100,multiplier=toNumber(multiplierInput.value);
  if(!(spot>0)||!Number.isFinite(rate)||!(vol>0)||!(multiplier>0))return null;
  const parsed=legs.map((leg,i)=>({kind:leg.kind,side:leg.side,qty:toNumber(leg.qty),strike:overrides.strikes?overrides.strikes[i]:toNumber(leg.strike),time:overrides.times?overrides.times[i]:(overrides.time??toNumber(leg.time)),vol,rate,dividend:toNumber(leg.dividend)/100}));
  if(!parsed.every(l=>Number.isFinite(l.qty)&&l.qty>0&&l.strike>0&&l.time>=0&&l.vol>0&&Number.isFinite(l.rate)&&Number.isFinite(l.dividend)))return null;
  return{spot,multiplier,legs:parsed};
}
function calculatePortfolio(overrides={}){const inputs=readInputs(overrides);if(!inputs)return null;return inputs.legs.reduce((tot,l)=>{const scale=(l.side==='buy'?1:-1)*l.qty*inputs.multiplier,vals=blackScholes(l.kind,inputs.spot,l.strike,l.time,l.rate,l.vol,l.dividend);metrics.forEach(m=>tot[m]+=vals[m]*scale);return tot},Object.fromEntries(metrics.map(m=>[m,0])))}
function calculatePayoff(spotOverride){const inputs=readInputs({spot:spotOverride});if(!inputs)return null;return inputs.legs.reduce((tot,l)=>tot+(l.side==='buy'?1:-1)*l.qty*inputs.multiplier*(l.kind==='call'?Math.max(inputs.spot-l.strike,0):Math.max(l.strike-inputs.spot,0)),0)}
function formatValue(v){if(!Number.isFinite(v))return'--';return v.toLocaleString(undefined,{minimumFractionDigits:Math.abs(v)<10?4:2,maximumFractionDigits:Math.abs(v)<10?4:2})}
function renderSummary(totals){summaryElement.innerHTML='';for(let r=0;r<3;r++)for(let c=0;c<metricLayout.length;c++){const metric=metricLayout[c][r];if(!metric){summaryElement.appendChild(document.createElement('div'));continue}const row=document.createElement('div');row.className='metric';const name=document.createElement('span');name.className='metric-label';if(metric==='volga')name.textContent='volga (vol of vol)';else if(metric==='vanna')name.innerHTML='vanna (<span class="metric-formula"><span>&part;Vega</span><span>&part;Spot</span></span>)';else name.textContent=metric;const value=document.createElement('span');value.textContent=totals?formatValue(totals[metric]):'--';const button=document.createElement('button');button.type='button';button.textContent='plot';button.onclick=()=>{activeMetric=metric;update()};row.append(name,value,button);summaryElement.appendChild(row)}}
function renderLegs(){legsElement.innerHTML='';legs.forEach((leg,index)=>{const row=document.createElement('div');row.className='leg';row.innerHTML=`<select data-field="side"><option value="buy">buy</option><option value="sell">sell</option></select><select data-field="kind"><option value="call">call</option><option value="put">put</option></select><input data-field="qty" type="number" min="0.01" step="0.01"><input data-field="strike" type="number" min="0.01" step="0.01"><input data-field="time" type="number" min="0" step="0.01"><input data-field="dividend" type="number" step="0.01"><button type="button">x</button>`;row.querySelector('[data-field="side"]').value=leg.side;row.querySelector('[data-field="kind"]').value=leg.kind;['qty','strike','time','dividend'].forEach(f=>row.querySelector(`[data-field="${f}"]`).value=leg[f]);row.querySelectorAll('input,select').forEach(input=>input.oninput=()=>{legs[index][input.dataset.field]=input.value;update()});row.querySelector('button').onclick=()=>{legs.splice(index,1);if(!legs.length)legs.push({kind:'call',side:'buy',qty:1,strike:100,time:.5,dividend:0});renderLegs();update()};legsElement.appendChild(row)})}
function baseLayout(title,xTitle,yTitle,markerX=null){const shapes=markerX===null?[]:[{type:'line',x0:markerX,x1:markerX,y0:0,y1:1,yref:'paper',line:{color:'#ff4444',dash:'dash',width:2}}];return{paper_bgcolor:'#000',plot_bgcolor:'#000',font:{color:'#fff',family:'Source Code Pro, monospace'},margin:{l:64,r:24,t:36,b:54},title,xaxis:{title:xTitle,gridcolor:'rgba(255,255,255,.16)',zerolinecolor:'rgba(255,255,255,.3)'},yaxis:{title:yTitle,gridcolor:'rgba(255,255,255,.16)',zerolinecolor:'rgba(255,255,255,.3)'},shapes}}
function draw(x,y,title,xTitle,markerX=null){Plotly.react('plot',[{x,y,type:'scatter',mode:'lines',line:{color:'#fff',width:2}}],baseLayout(title,xTitle,activeMetric,markerX),{displayModeBar:false,responsive:true})}
function plotMetric(){
  const spot=toNumber(spotInput.value),axis=plotAxisInput.value,steps=120;if(!(spot>0)){Plotly.purge('plot');return}
  if(activeMetric==='payoff'){plotPayoff(spot);return}
  const x=[],y=[];
  if(axis==='spot'){const min=Math.max(.01,spot*.45),max=spot*1.55,tte=selectedTte();for(let i=0;i<=steps;i++){const level=min+(max-min)*i/steps,tot=calculatePortfolio({spot:level,time:tte});if(!tot)return Plotly.purge('plot');x.push(level);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs spot (TTE ${tte.toFixed(2)}y)`,'spot',spot)}
  else if(axis==='moneyness'){const min=.45,max=1.55,tte=selectedTte(),strikes=legs.map(l=>toNumber(l.strike));for(let i=0;i<=steps;i++){const m=min+(max-min)*i/steps;const referenceStrike=strikes[0];const level=m*referenceStrike;const tot=calculatePortfolio({spot:level,time:tte});if(!tot)return Plotly.purge('plot');x.push(m);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs moneyness (TTE ${tte.toFixed(2)}y)`,'moneyness (S/K)',1)}
  else{const maxTau=2,minTau=1/365;for(let i=0;i<=steps;i++){const tau=maxTau-(maxTau-minTau)*i/steps,tot=calculatePortfolio({time:tau});if(!tot)return Plotly.purge('plot');x.push(tau);y.push(tot[activeMetric])}draw(x,y,`${activeMetric} vs tau`,'tau (years)',null)}
}
function plotPayoff(spot){const min=Math.max(.01,spot*.45),max=spot*1.55,steps=120,x=[],y=[];for(let i=0;i<=steps;i++){const level=min+(max-min)*i/steps,p=calculatePayoff(level);if(p===null)return Plotly.purge('plot');x.push(level);y.push(p)}Plotly.react('plot',[{x,y,type:'scatter',mode:'lines',line:{color:'#fff',width:2}}],baseLayout('payoff vs spot','spot','payoff',spot),{displayModeBar:false,responsive:true})}
function updateControls(){const tau=plotAxisInput.value==='tau';tteControl.style.opacity=tau?.45:1;tteSlider.disabled=tau;tteOutput.value=selectedTte().toFixed(2)}
function update(){updateControls();const totals=calculatePortfolio();invalidElement.textContent=totals?'':'invalid inputs';renderSummary(totals);plotMetric()}
$('add-leg').onclick=()=>{legs.push({kind:'call',side:'buy',qty:1,strike:toNumber(spotInput.value)||100,time:.5,dividend:0});renderLegs();update()};plotPayoffButton.onclick=()=>{activeMetric='payoff';update()};
[spotInput,rateInput,volatilityInput,multiplierInput,plotAxisInput,asOfInput,tteSlider].forEach(input=>input.addEventListener('input',update));
asOfInput.value=new Date().toISOString().slice(0,10);renderLegs();update();
