"""Live-feature browser checks with explicit simulated feeds, not live-source evidence.
Start a server at LIVE_TEST_BASE (defaults to http://127.0.0.1:8001).
"""
from playwright.sync_api import sync_playwright
from datetime import datetime, timezone, timedelta
import json, os, urllib.request, urllib.error, gzip, math
from pathlib import Path
roads=json.loads(gzip.decompress((Path(__file__).resolve().parents[1]/"tools/map-data/roads.geojson.gz").read_bytes()))
a12=next(f for f in roads["features"] if f["properties"]["route"]=="A12")["geometry"]["coordinates"]
curve=next(line for line in a12 if len(line)>=8 and sum(math.dist(a,b) for a,b in zip(line,line[1:]))<1.5*math.dist(line[0],line[-1]))
base=os.environ.get('LIVE_TEST_BASE','http://127.0.0.1:8001')
now=datetime.now(timezone.utc)
iso=lambda delta: (now+timedelta(seconds=delta)).isoformat()
traffic={'status':'ok','source':'NDW','sourceUpdatedAt':iso(-20),'checkedAt':iso(0),'expiresAt':iso(280),'unmappedReports':1,'jams':[
 {'id':'test-only-line','road':'A12','type':'queuingTraffic','geometry':{'type':'MultiLineString','coordinates':[[curve[0],curve[-1]]]}},
 {'id':'test-only-point','road':'A4','type':'slowTraffic','geometry':{'type':'Point','coordinates':[4.40,52.05]}}]}
news={'status':'ok','source':'NU.nl Auto','checkedAt':iso(0),'expiresAt':iso(1100),'articles':[
 {'title':'TESTKOP — uitsluitend gesimuleerde brondata','url':'https://www.nu.nl/auto/1/test','publishedAt':iso(-3600)},
 {'title':'Tweede gesimuleerde nieuwskop','url':'https://www.nu.nl/auto/2/test','publishedAt':iso(-7200)},
 {'title':'<img src=x onerror=alert(1)>','url':'https://www.nu.nl/auto/3/test','publishedAt':iso(-10800)},
 {'title':'Verouderd bericht','url':'https://www.nu.nl/auto/4/old','publishedAt':iso(-300000)}]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,390,768,1440]:
  page=browser.new_page(viewport={'width':width,'height':1000})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/api/traffic.php',lambda r:r.fulfill(content_type='application/json',body=json.dumps(traffic)))
  page.route('**/api/news.php',lambda r:r.fulfill(content_type='application/json',body=json.dumps(news)))
  page.goto(base+'/')
  page.wait_for_selector('.traffic-segment',state='attached')
  assert page.locator('.traffic-segment').count()==1
  assert page.locator('body.map-integrated').count()==1
  assert page.locator('[data-traffic-background] svg #highways').count()==1
  assert page.locator('.traffic-segment').get_attribute('d').count('L')>=7
  assert page.locator('[data-traffic-background] svg').count()==1
  assert page.locator('.traffic-point').count()==1
  assert '2 filelocaties' in page.locator('[data-traffic-status]').inner_text()
  assert page.locator('.news-card').count()==3
  assert page.locator('.news-card img').count()==0,'News headline must be text, not executable markup'
  assert page.locator('.news-card').filter(has_text='Verouderd bericht').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Same responsive placement as the existing SVG background.
  expected=(640/1100*1440) if width<=650 else max(width/1440,1000/1100)*1440
  actual=page.locator('[data-traffic-background] svg').evaluate('(e)=>parseFloat(e.style.width)')
  assert abs(actual-expected)<1,(width,actual,expected)
  page.locator('#actueel').screenshot(path=f'/tmp/live-features-{width}.png')
  assert not errors,errors
  print('PASS',width,'simulated traffic geometry, map alignment, recent headlines, safe rendering, no overflow/errors')
  page.close()
 # Expired source data must not turn roads red, even if HTTP returns 200.
 page=browser.new_page()
 page.route('**/api/traffic.php',lambda r:r.fulfill(content_type='application/json',body=json.dumps({**traffic,'sourceUpdatedAt':iso(-1000),'expiresAt':iso(-700)})))
 page.route('**/api/news.php',lambda r:r.fulfill(status=503,content_type='application/json',body='{"status":"unavailable"}'))
 page.goto(base+'/');page.wait_for_function("document.querySelector('[data-traffic-status]').dataset.state==='unavailable'")
 assert page.locator('.traffic-segment,.traffic-point').count()==0
 assert page.locator('.news-card').count()==0
 print('PASS stale traffic / unavailable news: no red roads or invented news')
 page.close()
 # An initially fresh report must also disappear without another response.
 page=browser.new_page()
 page.clock.install(time=now)
 page.route('**/api/traffic.php',lambda r:r.fulfill(content_type='application/json',body=json.dumps({**traffic,'sourceUpdatedAt':iso(-299),'expiresAt':iso(1)})))
 page.route('**/api/news.php',lambda r:r.fulfill(content_type='application/json',body=json.dumps(news)))
 page.goto(base+'/');page.wait_for_selector('.traffic-segment',state='attached')
 page.clock.fast_forward(6000)
 assert page.locator('.traffic-segment,.traffic-point').count()==0
 assert page.locator('[data-traffic-status]').get_attribute('data-state')=='unavailable'
 print('PASS expiry timer: current red roads disappear after provider expiry')
 page.close()
 # A failed base-map download must not draw unmatched traffic; a later refresh retries.
 page=browser.new_page()
 page.clock.install(time=now)
 attempts=[0]
 def map_response(route):
  if route.request.resource_type=='fetch':
   attempts[0]+=1
   if attempts[0]==1:
    route.fulfill(status=503,body='unavailable');return
  route.continue_()
 page.route('**/assets/netherlands-roads.svg?*',map_response)
 page.route('**/api/traffic.php',lambda r:r.fulfill(content_type='application/json',body=json.dumps(traffic)))
 page.route('**/api/news.php',lambda r:r.fulfill(status=503,content_type='application/json',body='{}'))
 page.goto(base+'/')
 page.wait_for_function("document.querySelector('[data-traffic-status]').dataset.state==='unavailable'")
 assert page.locator('.traffic-segment,.traffic-point').count()==0
 assert page.locator('body.map-integrated').count()==0
 page.clock.fast_forward(61000)
 page.wait_for_selector('body.map-integrated')
 page.wait_for_selector('.traffic-segment',state='attached')
 assert attempts[0]==2
 print('PASS failed map asset: static fallback, no detached red roads, retry succeeds')
 page.close()
 # No JS still offers a useful static site and source links.
 page=browser.new_page(java_script_enabled=False)
 page.goto(base+'/')
 assert page.locator('#actueel a').count()>=3
 assert page.locator('.traffic-segment').count()==0
 print('PASS no-JavaScript source links and static map')
 browser.close()
