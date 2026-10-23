// Deterministic calculations. Null means insufficient/undefined, never zero-fill.
export const last = a => a.length ? a[a.length - 1] : null;
export const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
export const std = a => a.length>1 ? Math.sqrt(a.reduce((s,v)=>s+(v-mean(a))**2,0)/(a.length-1)) : null;
export function sma(a,n) { return a.map((_,i)=>i+1<n||a.slice(i+1-n,i+1).some(v=>v==null)?null:mean(a.slice(i+1-n,i+1))); }
export function ema(a,n) {
  const out=a.map(()=>null); let value=null, warm=[];
  for(let i=0;i<a.length;i++) { if(a[i]==null) {warm=[]; value=null;continue;} if(value==null) {warm.push(a[i]);if(warm.length===n)value=mean(warm);}else value=a[i]*2/(n+1)+value*(1-2/(n+1));out[i]=value; }
  return out;
}
export function wma(a,n) { return a.map((_,i)=>i+1<n?null:a.slice(i+1-n,i+1).reduce((s,v,j)=>s+v*(j+1),0)/(n*(n+1)/2)); }
export function rsi(a,n=14) {
  const out=a.map(()=>null); if(a.length<=n)return out;
  let gain=0,loss=0;
  for(let i=1;i<=n;i++){gain+=Math.max(0,a[i]-a[i-1])/n;loss+=Math.max(0,a[i-1]-a[i])/n;}
  const calc=()=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
  out[n]=calc();for(let i=n+1;i<a.length;i++){gain=(gain*(n-1)+Math.max(0,a[i]-a[i-1]))/n;loss=(loss*(n-1)+Math.max(0,a[i-1]-a[i]))/n;out[i]=calc();}return out;
}
export function macd(a,fast=12,slow=26,signal=9) {
  const f=ema(a,fast),s=ema(a,slow),line=a.map((_,i)=>f[i]!=null&&s[i]!=null?f[i]-s[i]:null),sig=ema(line,signal);
  return {line,signal:sig,histogram:line.map((v,i)=>v!=null&&sig[i]!=null?v-sig[i]:null)};
}
export function bollinger(a,n=20,k=2) { const mid=sma(a,n);return {mid,upper:mid.map((v,i)=>v==null?null:v+k*std(a.slice(i+1-n,i+1))),lower:mid.map((v,i)=>v==null?null:v-k*std(a.slice(i+1-n,i+1)))}; }
export function atr(bars,n=14) {
  const tr=bars.map((b,i)=>i?Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)):b.high-b.low),out=tr.map(()=>null);
  if(tr.length<n)return out;let value=mean(tr.slice(0,n));out[n-1]=value;for(let i=n;i<tr.length;i++){value=(value*(n-1)+tr[i])/n;out[i]=value;}return out;
}
export function obv(bars){let v=0;return bars.map((b,i)=>{if(i)v+=Math.sign(b.close-bars[i-1].close)*(b.volume||0);return v;});}
export function stochastic(bars,n=14){return bars.map((b,i)=>{if(i+1<n)return null;const p=bars.slice(i+1-n,i+1),hi=Math.max(...p.map(x=>x.high)),lo=Math.min(...p.map(x=>x.low));return hi===lo?50:100*(b.close-lo)/(hi-lo);});}
export function dailyReturns(a){return a.slice(1).map((v,i)=>v/a[i]-1);}
export function volatility(a,n=20){const r=dailyReturns(a);return a.map((_,i)=>i<n?null:std(r.slice(i-n,i))*Math.sqrt(252));}
export function drawdowns(a){let peak=-Infinity;return a.map(v=>{peak=Math.max(peak,v);return v/peak-1;});}
export function correlation(a,b){if(a.length!==b.length||a.length<2)return null;const ma=mean(a),mb=mean(b),da=a.map(v=>v-ma),db=b.map(v=>v-mb);const den=Math.sqrt(da.reduce((s,v)=>s+v*v,0)*db.reduce((s,v)=>s+v*v,0));return den?da.reduce((s,v,i)=>s+v*db[i],0)/den:null;}
export function beta(a,b){const sb=std(b),sa=std(a),r=correlation(a,b);return r==null||!sb?null:r*sa/sb;}
export function metrics(equity,riskFree=0,dates=null){
  if(equity.length<2||equity.some(x=>!Number.isFinite(x)||x<=0))return null;
  const r=dailyReturns(equity),sd=std(r),years=dates?(Date.parse(last(dates))-Date.parse(dates[0]))/(365.25*86400000):r.length/252;
  const vol=sd==null?null:sd*Math.sqrt(252),annual=years>0?(last(equity)/equity[0])**(1/years)-1:null;
  const down=Math.sqrt(mean(r.map(x=>Math.min(0,x-riskFree/252)**2)))*Math.sqrt(252);
  const sorted=[...r].sort((a,b)=>a-b),q=sorted[Math.max(0,Math.ceil(sorted.length*.05)-1)],tail=sorted.filter(x=>x<=q),mdd=Math.min(...drawdowns(equity));
  return {total:last(equity)/equity[0]-1,cagr:annual,volatility:vol,sharpe:vol?(mean(r)*252-riskFree)/vol:null,sortino:down?(mean(r)*252-riskFree)/down:null,maxDrawdown:mdd,calmar:mdd&&annual!=null?annual/Math.abs(mdd):null,var95:-q,es95:-mean(tail),positiveDays:r.filter(v=>v>0).length/r.length};
}
export function aggregate(bars,interval){
  if(interval==='D')return bars;const groups=new Map();
  for(const b of bars){const d=new Date(b.date+'T00:00:00Z');if(interval==='W')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const key=interval==='M'?b.date.slice(0,7):d.toISOString().slice(0,10);const p=groups.get(key);if(p){p.high=Math.max(p.high,b.high);p.low=Math.min(p.low,b.low);p.close=b.close;p.volume=p.volume==null?null:p.volume+(b.volume||0);p.date=b.date;}else groups.set(key,{...b});}return [...groups.values()];
}
export function signalAt(bars,index,{strategy='trend',lookback=60,targetVol=.2}={}) {
  if(index<0)return null;const past=bars.slice(0,index+1),c=past.map(b=>b.close);
  if(strategy==='hold')return 1;
  if(c.length<lookback)return null;
  if(strategy==='trend')return last(c)>last(sma(c,lookback))?1:0;
  if(strategy==='vol'){const v=last(volatility(c,Math.min(20,lookback)));return v?Math.min(1,targetVol/v):null;}
  return null;
}
export function backtest(series,config={}) {
  const {weights={'0050':1},strategy='hold',initial=1000000,fee=.001425,sellTax=.001,slippage=.0005,minFee=20,rebalance='monthly',lookback=60,startDate='',endDate='9999',benchmark='0050'}=config;
  const symbols=Object.keys(weights).filter(s=>weights[s]>0),sum=Object.values(weights).reduce((a,b)=>a+b,0);
  if(!symbols.length||sum>1.000001||sum<0||Object.values(weights).some(w=>!Number.isFinite(w)||w<0))throw Error('權重合計必須大於 0 且不超過 100%。');
  if(!Number.isFinite(initial)||initial<=0||[fee,sellTax,slippage,minFee].some(x=>!Number.isFinite(x)||x<0)||lookback<2)throw Error('請輸入有效的資金、費用與回看天數。');
  const all=[...new Set([...symbols,benchmark,...(strategy==='switch'?['0050','2330']:[])])];
  for(const s of all)if(!series[s]?.length)throw Error(`${s} 的歷史資料不足。`);
  const maps=Object.fromEntries(all.map(s=>[s,new Map(series[s].map((b,i)=>[b.date,{...b,index:i}]))]));
  const dates=series[benchmark].map(b=>b.date).filter(d=>d>=startDate&&d<=endDate&&all.every(s=>maps[s].has(d)));
  if(dates.length<3)throw Error('共同交易日不足，請擴大回測區間。');
  const active=strategy==='switch'?['0050','2330']:symbols,shares=Object.fromEntries(active.map(s=>[s,0]));let cash=initial,cost=0,turnover=0,prevMonth='',prevTarget='',lastSignalDate=null;
  const curve=[{date:dates[0],value:initial,benchmark:initial,exposure:0}],trades=[];
  const benchStart=maps[benchmark].get(dates[1]).open; // both buy next session open
  for(let i=1;i<dates.length;i++){
    const date=dates[i],previousDate=dates[i-1];let target={};
    if(strategy==='switch'){
      const momentum=s=>{const ix=maps[s].get(previousDate).index;return ix>=lookback?series[s][ix].close/series[s][ix-lookback].close-1:null;};
      const a=momentum('0050'),b=momentum('2330');if(a!=null&&b!=null)target[a>=b?'0050':'2330']=1;
    }else for(const s of symbols){const exp=signalAt(series[s],maps[s].get(previousDate).index,{strategy,lookback,targetVol:config.targetVol||.2});target[s]=exp==null?0:weights[s]*exp;}
    const targetKey=JSON.stringify(target),month=date.slice(0,7),isDynamic=strategy!=='hold',change=(isDynamic&&targetKey!==prevTarget)||i===1||(rebalance==='monthly'&&month!==prevMonth);
    if(change){
      const equityOpen=cash+active.reduce((v,s)=>v+shares[s]*maps[s].get(date).open,0),desired={};
      for(const s of active)desired[s]=Math.floor(equityOpen*(target[s]||0)/(maps[s].get(date).open*(1+slippage+fee)));
      for(const side of ['SELL','BUY'])for(const s of active){
        let qty=side==='SELL'?shares[s]-desired[s]:desired[s]-shares[s];if(qty<=0)continue;
        const price=maps[s].get(date).open*(1+(side==='BUY'?slippage:-slippage));
        if(side==='BUY')qty=Math.min(qty,Math.max(0,Math.floor((cash-minFee)/(price*(1+fee)))));
        if(qty<=0)continue;const gross=qty*price,commission=Math.max(minFee,gross*fee),tax=side==='SELL'?gross*sellTax:0;
        if(side==='BUY'&&gross+commission>cash)continue;
        cash+=side==='BUY'?-gross-commission:gross-commission-tax;shares[s]+=side==='BUY'?qty:-qty;cost+=commission+tax;turnover+=gross;
        trades.push({date,signalDate:previousDate,symbol:s,side,qty,price,commission,tax,cash});
      }
      prevTarget=targetKey;lastSignalDate=previousDate;
    }
    const holding=active.reduce((v,s)=>v+shares[s]*maps[s].get(date).close,0),value=cash+holding;
    curve.push({date,value,benchmark:initial*maps[benchmark].get(date).close/benchStart,exposure:holding/value,cash});prevMonth=month;
  }
  const eq=curve.map(x=>x.value),bm=curve.map(x=>x.benchmark),stats=metrics(eq,config.riskFree||0,dates),benchmarkStats=metrics(bm,config.riskFree||0,dates);
  const r=dailyReturns(eq),br=dailyReturns(bm),b=beta(r,br),te=std(r.map((x,i)=>x-br[i]));
  return {config:{...config,weights,strategy,initial,fee,sellTax,slippage,minFee,lookback},curve,trades,stats,benchmarkStats,beta:b,trackingError:te==null?null:te*Math.sqrt(252),cost,turnover:turnover/initial,lastSignalDate,dates};
}
export function features(bars){const c=bars.map(x=>x.close);if(!c.length)return {};return {sma20:last(sma(c,20)),sma60:last(sma(c,60)),sma120:last(sma(c,120)),rsi:last(rsi(c)),vol:last(volatility(c)),atr:last(atr(bars)),momentum:c.length>20?last(c)/c[c.length-21]-1:null,drawdown:last(drawdowns(c)),observations:c.length};}
export function researchReport(symbol,bars,metadata={}){
  const f=features(bars),price=last(bars)?.close;if(f.sma60==null)return {status:'INSUFFICIENT_DATA',symbol,missing:['至少 60 筆日線'],features:f};
  const rising=price>f.sma60,fast=price>f.sma20,regime=rising&&fast?'上升趨勢':!rising&&!fast?'下降趨勢':'過渡整理';
  return {version:'baseline-trend-v1',status:'PARTIAL_EVIDENCE',symbol,date:last(bars).date,generatedAt:new Date().toISOString(),regime,features:f,price,source:metadata.source||'TWSE',stages:['S0 研究範圍：日線／台股','S1 讀取已收集的官方資料',`S2 驗證 ${bars.length} 筆可用日線`,'S3 計算均線、動能與波動','S4 套用 baseline-trend-v1','S5 比較延續與反轉情境','S6 描述歷史回撤與風險','S7 產生結構化研究報告'],evidence:[`收盤價 ${price.toFixed(2)} ${rising?'高於':'低於'} 60 日均線 ${f.sma60.toFixed(2)}`,`20 日動能 ${f.momentum==null?'不足':(f.momentum*100).toFixed(2)+'%'}`,`RSI(14) ${f.rsi?.toFixed(1)??'資料不足'}`],invalidation:`若收盤價${rising?'跌破':'站回'} 60 日均線，重新評估 ${regime} 假設。`,alternative:fast!==rising?'短期與中期趨勢相反，可能是反彈或回檔。':`若價格${rising?'跌破':'站上'} 20 日均線，趨勢延續證據將減弱。`,missing:['籌碼與融資券','點時財報及法說預期','經驗校準的情境機率','原始七階段模型（尚未匯入）'],limitations:['規則式研究，未連接 LLM。','使用未還原日線，不含股利；不具價格預測能力。','不是使用者原有七階段行情模型。']};
}
