"""Official, public end-of-day providers. No synthesized market observations."""
import argparse
import concurrent.futures
import csv
import datetime as dt
import io
import json
import math
import pathlib
import re
import subprocess
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CORE = ['0050', '0056', '00878', '006208', '00713', '00646', '2330', '2317', '2454', '2308', '2382', '2881', '2891', '2603']
INDUSTRIES = {'01':'水泥工業','02':'食品工業','03':'塑膠工業','04':'紡織纖維','05':'電機機械','06':'電器電纜','08':'玻璃陶瓷','09':'造紙工業','10':'鋼鐵工業','11':'橡膠工業','12':'汽車工業','14':'建材營造','15':'航運業','16':'觀光餐旅','17':'金融保險','18':'貿易百貨','19':'綜合','20':'其他','21':'化學工業','22':'生技醫療','23':'油電燃氣','24':'半導體業','25':'電腦及週邊','26':'光電業','27':'通信網路','28':'電子零組件','29':'電子通路','30':'資訊服務','31':'其他電子','32':'文化創意','33':'農業科技','34':'電子商務','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活'}
FRED = {'DGS10': ('美國 10 年期公債', '%', '利率'), 'DGS2': ('美國 2 年期公債', '%', '利率'), 'FEDFUNDS': ('聯邦基金有效利率', '%', '政策'), 'UNRATE': ('美國失業率', '%', '成長'), 'CPIAUCSL': ('美國 CPI 指數', '1982–84=100', '通膨'), 'DEXTAUS': ('美元／新台幣', 'TWD/USD', '匯率')}

def number(v):
    try:
        result = float(str(v).replace(',', '').replace('X', '').replace('+', '').strip())
        return result if math.isfinite(result) else None
    except (ValueError, TypeError): return None

def roc_date(value):
    text = str(value).replace('/', '').replace('-', '')
    if len(text) == 7: return f'{int(text[:3])+1911}-{text[3:5]}-{text[5:7]}'
    if len(text) == 8: return f'{text[:4]}-{text[4:6]}-{text[6:8]}'
    raise ValueError(f'Invalid date {value!r}')

def request(url, as_json=True, timeout=25, attempts=3):
    error = None
    for attempt in range(attempts):
        try:
            if not as_json:
                result = subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time',str(timeout),url],capture_output=True,text=True,check=True)
                return result.stdout
            req = urllib.request.Request(url, headers={'User-Agent': 'TWAVE/1.0 public-data-research', 'Accept': 'application/json,text/csv,*/*'})
            with urllib.request.urlopen(req, timeout=timeout) as response: body = response.read().decode('utf-8-sig')
            return json.loads(body) if as_json else body
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            error = exc
            time.sleep(0.5 * 2**attempt)
    raise RuntimeError(f'SOURCE_UNAVAILABLE: {url}: {error}')

def parse_fred_table(text, cutoff):
    # FRED's public text export currently returns its official table in HTML.
    # Parse the real table and its deferred rows; do not execute provider JS.
    rows = re.findall(r'<th[^>]*>(\d{4}-\d{2}-\d{2})</th>\s*<td[^>]*>\s*([\d.,-]+)\s*</td>', text)
    rows += re.findall(r'#(\d{4}-\d{2}-\d{2})\|\s*([\d.,-]+)', text)
    rows += re.findall(r'^(\d{4}-\d{2}-\d{2})\s+([\d.,-]+)\s*$',text,re.M)
    data={date:number(value) for date,value in rows if date>=cutoff and number(value) is not None}
    return [{'date':date,'value':data[date]} for date in sorted(data)]

def validate_bars(bars):
    result = {}; issues = []
    for b in bars:
        if b['date'] in result: issues.append({'code':'DUPLICATE_OBSERVATION', 'date':b['date']})
        if not all(isinstance(b.get(k), (int,float)) and math.isfinite(b[k]) and b[k] > 0 for k in ['open','high','low','close']):
            issues.append({'code':'VALIDATION_FAILED', 'date':b['date']}); continue
        if b['high'] < max(b['open'], b['close']) or b['low'] > min(b['open'], b['close']) or b['high'] < b['low']:
            issues.append({'code':'VALIDATION_FAILED', 'date':b['date']}); continue
        result[b['date']] = b
    ordered = sorted(result.values(), key=lambda b:b['date'])
    for a,b in zip(ordered,ordered[1:]):
        # Official daily change identifies reference-price adjustments. This does
        # not attempt to infer a dividend or split adjustment factor.
        ref = b['close'] - (b.get('change') or 0)
        if abs(ref/a['close']-1) > 0.2:
            issues.append({'code':'CORPORATE_ACTION_REVIEW_REQUIRED', 'date':b['date']})
    return ordered, issues

def month_dates(count):
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    n = today.year*12+today.month-1
    return [f'{(n-i)//12:04d}{(n-i)%12+1:02d}01' for i in range(count-1,-1,-1)]

def history_month(symbol, month):
    index = symbol == 'TAIEX'
    path = 'indicesReport/MI_5MINS_HIST' if index else 'exchangeReport/STOCK_DAY'
    url = f'https://www.twse.com.tw/{path}?response=json&date={month}' + ('' if index else f'&stockNo={symbol}')
    data = request(url)
    if data.get('stat') != 'OK': raise RuntimeError(f'NOT_PUBLISHED: {symbol} {month} {data.get("stat")}')
    bars = []
    for row in data.get('data', []):
        if index:
            bar = dict(date=roc_date(row[0]), open=number(row[1]), high=number(row[2]), low=number(row[3]), close=number(row[4]), volume=None)
        else:
            bar = dict(date=roc_date(row[0]), volume=number(row[1]), open=number(row[3]), high=number(row[4]), low=number(row[5]), close=number(row[6]), change=number(row[7]))
        bars.append(bar)
    return bars

def atomic_json(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':')),encoding='utf-8')
    tmp.replace(path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--months',type=int,default=13)
    parser.add_argument('--skip-macro',action='store_true')
    args=parser.parse_args()
    ingested=dt.datetime.now(dt.timezone.utc).isoformat()
    errors=[]
    base='https://openapi.twse.com.tw/v1/'
    endpoints={'prices':'exchangeReport/STOCK_DAY_ALL', 'valuations':'exchangeReport/BWIBBU_ALL', 'companies':'opendata/t187ap03_L', 'indices':'exchangeReport/MI_INDEX'}
    sources={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        fs={pool.submit(request,base+p):k for k,p in endpoints.items()}
        for future in concurrent.futures.as_completed(fs):
            key=fs[future]
            try: sources[key]=future.result()
            except Exception as exc:
                errors.append({'source':key,'code':'SOURCE_UNAVAILABLE','message':str(exc)})
    if not sources.get('prices'): raise RuntimeError('Current price collection failed. Previous snapshot is preserved.')
    valuations={x['Code']:x for x in sources.get('valuations',[])}
    companies={x['公司代號']:x for x in sources.get('companies',[])}
    stocks=[]
    for p in sources['prices']:
        symbol=p.get('Code',''); price=number(p.get('ClosingPrice'))
        if not price or not (len(symbol)==4 or symbol.startswith('00')): continue
        c=companies.get(symbol,{}); v=valuations.get(symbol,{})
        shares=number(c.get('已發行普通股數或TDR原股發行股數')); change=number(p.get('Change'))
        prev=price-change if change is not None else None
        stocks.append(dict(symbol=symbol,name=p['Name'],exchange='TWSE',currency='TWD',type='ETF' if symbol.startswith('00') else '股票',sector='ETF' if symbol.startswith('00') else INDUSTRIES.get(c.get('產業別'),'其他'),price=price,change=change,pct=(change/prev*100 if prev and change is not None else None),volume=number(p.get('TradeVolume')),turnover=number(p.get('TradeValue')),open=number(p.get('OpeningPrice')),high=number(p.get('HighestPrice')),low=number(p.get('LowestPrice')),pe=number(v.get('PEratio')),pb=number(v.get('PBratio')),yieldPct=number(v.get('DividendYield')),valuationDate=roc_date(v['Date']) if v.get('Date') else None,marketCap=price*shares if shares else None,date=roc_date(p['Date'])))
    if len(stocks)<500: raise RuntimeError('SCHEMA_ERROR: unexpected price universe; previous data preserved')
    indices=[]
    seen=set()
    for item in sources.get('indices',[]):
        name=item.get('指數'); date=roc_date(item['日期'])
        if name in seen: continue
        seen.add(name)
        sign=-1 if item.get('漲跌')=='-' else 1
        indices.append(dict(name=name,date=date,price=number(item.get('收盤指數')),change=sign*(number(item.get('漲跌點數')) or 0),pct=number(item.get('漲跌百分比'))))
    stocks.sort(key=lambda x:x['turnover'] or 0,reverse=True)
    market={'schemaVersion':1,'ingestedAt':ingested,'observationDate':max(x['date'] for x in stocks),'provider':'TWSE','frequency':'daily','adjustment':'unadjusted','currency':'TWD','stocks':stocks,'indices':indices,'errors':errors,'sources':{k:base+p for k,p in endpoints.items()},'licenseUrl':'https://www.twse.com.tw/zh/terms/use.html','publicationTimestamp':None,'availableAt':ingested}
    atomic_json(ROOT/'data/market.json',market)
    history_path=ROOT/'data/history.json'
    history=json.loads(history_path.read_text()) if history_path.exists() else {'schemaVersion':1,'series':{},'issues':{}}
    months=month_dates(args.months)
    tasks=[]
    for symbol in ['TAIEX']+CORE:
        previous=history['series'].get(symbol,[])
        existing={b['date'][:7].replace('-','') for b in previous}
        for month in months:
            if month[:6] not in existing or month==months[-1]: tasks.append((symbol,month))
    print(f'Collected {len(stocks)} securities. Backfilling {len(tasks)} instrument-months.',flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(history_month,*task):task for task in tasks}
        for n,future in enumerate(concurrent.futures.as_completed(futures),1):
            symbol,month=futures[future]
            try:
                incoming=future.result()
                old={b['date']:b for b in history['series'].get(symbol,[])}
                old.update({b['date']:b for b in incoming})
                history['series'][symbol]=list(old.values())
            except Exception as exc: errors.append({'source':symbol,'month':month,'code':'SOURCE_UNAVAILABLE','message':str(exc)})
            if n%15==0: print(f'History {n}/{len(tasks)}',flush=True)
    for symbol,bars in history['series'].items():
        history['series'][symbol],history['issues'][symbol]=validate_bars(bars)
    reference={b['date'] for b in history['series'].get('TAIEX',[])}
    history['coverage']={s:{'count':len(bs),'first':bs[0]['date'] if bs else None,'last':bs[-1]['date'] if bs else None,'missingSessions':[d for d in sorted(reference) if bs and bs[0]['date']<=d<=bs[-1]['date'] and d not in {b['date'] for b in bs}]} for s,bs in history['series'].items()}
    history.update(ingestedAt=ingested,provider='TWSE',adjustment='unadjusted',frequency='daily',currency='TWD',errors=errors,source='https://www.twse.com.tw/exchangeReport/STOCK_DAY',indexSource='https://www.twse.com.tw/indicesReport/MI_5MINS_HIST',requestedMonths=args.months,availableAt=ingested,publicationTimestamp=None)
    atomic_json(history_path,history)
    macro_path=ROOT/'data/macro.json'
    macro=json.loads(macro_path.read_text()) if macro_path.exists() else {'series':{}}
    if not args.skip_macro:
        for symbol,(name,unit,group) in FRED.items():
            url=f'https://fred.stlouisfed.org/data/{symbol}.txt'
            try:
                values=parse_fred_table(request(url,False,timeout=12,attempts=2),(dt.date.today()-dt.timedelta(days=800)).isoformat())
                if not values: raise RuntimeError('SCHEMA_ERROR: empty macro series')
                macro['series'][symbol]={'symbol':symbol,'name':name,'unit':unit,'group':group,'provider':'FRED','source':f'https://fred.stlouisfed.org/series/{symbol}','endpoint':url,'values':values,'ingestedAt':ingested,'vintage':'latest revised, not point-in-time','license':'https://fred.stlouisfed.org/legal/'}
            except Exception as exc: errors.append({'source':symbol,'code':'SOURCE_UNAVAILABLE','message':str(exc)})
    macro.update(ingestedAt=ingested,errors=[e for e in errors if e['source'] in FRED])
    atomic_json(macro_path,macro)
    market['errors']=errors
    atomic_json(ROOT/'data/market.json',market)
    print(f'Finished. History: {sum(len(v) for v in history["series"].values())} bars; macro: {len(macro["series"])}; errors: {len(errors)}',flush=True)

if __name__=='__main__': main()
