import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const market=JSON.parse(await readFile('data/market.json','utf8'));
const history=JSON.parse(await readFile('data/history.json','utf8'));
assert.ok(market.stocks.length>500,'Snapshot is unexpectedly small');
assert.equal(new Set(market.stocks.map(s=>s.symbol)).size,market.stocks.length,'Duplicate instruments');
for(const s of market.stocks){assert.ok(s.price>0&&Number.isFinite(s.price));assert.match(s.date,/^\d{4}-\d{2}-\d{2}$/);}
for(const symbol of ['0050','2330','TAIEX'])assert.ok(history.series[symbol]?.length>=120,`${symbol}: inadequate core history`);
for(const [symbol,bars] of Object.entries(history.series)){let previous='';for(const b of bars){assert.ok(b.date>previous,`${symbol}: duplicate or unordered date`);assert.ok(b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close));assert.ok(b.low>0);previous=b.date;}}
console.log(`Validated ${market.stocks.length} instruments and ${Object.keys(history.series).length} histories`);
