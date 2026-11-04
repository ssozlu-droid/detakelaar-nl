"""Functional browser checks with deterministic RDW responses, not live API evidence."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
from functools import partial
from playwright.sync_api import sync_playwright
import json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',8000),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width,height in [(1440,1000),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height})
   errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   page.route('https://opendata.rdw.nl/**',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps([{'kenteken':'AB12CD','merk':'TESTMERK','handelsbenaming':'Testmodel','datum_eerste_toelating':'20200102','massa_ledig_voertuig':'1100'}])))
   addresses=[{'id':'adr-'+'a'*32,'type':'adres','bron':'BAG','nummeraanduiding_id':'0344200000128086','huisnummer':93,'straatnaam':'Europalaan','woonplaatsnaam':'Utrecht','weergavenaam':'Europalaan 93, 3526KP Utrecht'},{'id':'adr-'+'b'*32,'type':'adres','bron':'BAG','nummeraanduiding_id':'0344200000128087','huisnummer':95,'straatnaam':'Europalaan','woonplaatsnaam':'Utrecht','weergavenaam':'Europalaan 95, 3526KP Utrecht'}]
   def pdok(route):
    from urllib.parse import urlparse,parse_qs
    u=urlparse(route.request.url);params=parse_qs(u.query)
    docs=[d for d in addresses if d['id']==params.get('id',[''])[0]] if u.path.endswith('/lookup') else addresses
    route.fulfill(content_type='application/json',body=json.dumps({'response':{'docs':docs}}))
   page.route('https://api.pdok.nl/**',pdok)
   page.goto('http://127.0.0.1:8000/')
   assert page.locator('[data-contact="tel"]').get_attribute('href')=='tel:+31682990303'
   assert page.locator('[data-contact="whatsapp"]').get_attribute('href')=='https://wa.me/31682990303'
   assert page.locator('#plate').bounding_box()['y']<height, 'Plate below first screen'
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
   page.locator('#plate').fill('ab-12-cd')
   page.locator('#lookup-button').click()
   page.wait_for_function("document.getElementById('vehicle').value === 'TESTMERK Testmodel'")
   assert 'Niet beschikbaar' in page.locator('#vehicle-result').inner_text()
   assert page.locator('#request-plate').input_value()=='AB12CD'
   page.locator('#pickup').fill('Europalaan 93')
   page.locator('#pickup-options [role=option]').first.click()
   page.wait_for_function("document.getElementById('pickup').value === 'Europalaan 93, 3526KP Utrecht'")
   page.locator('#delivery').fill('Europalaan 95')
   page.locator('#delivery-options [role=option]').nth(1).click()
   page.wait_for_function("document.getElementById('delivery').value === 'Europalaan 95, 3526KP Utrecht'")
   page.locator('#name').fill('Test klant')
   page.locator('#phone').fill('0612345678')
   page.locator('#type').select_option(label='Schadevervoer')
   page.locator('#timing').select_option('asap')
   # Intercept the generated external link; do not submit an actual transport request.
   page.evaluate("window.openedLinks=[]; HTMLAnchorElement.prototype.click=function(){if(typeof this.href!=='string'||!this.href.startsWith('https://wa.me/'))return;window.openedLinks.push(this.href);this.id='generated-whatsapp-link';document.body.append(this)}")
   page.locator('#send-button').click()
   page.wait_for_function('window.openedLinks.length > 0')
   link=page.locator('#generated-whatsapp-link').get_attribute('href')
   assert link.startswith('https://wa.me/31682990303?text=')
   assert 'Europalaan 93, 3526KP Utrecht' in page.locator('#message-text').input_value()
   assert 'Gewenste planning: Zo snel mogelijk' in page.locator('#message-text').input_value()
   # A specific day is required only for the custom-date choice.
   today=datetime.now(ZoneInfo('Europe/Amsterdam')).date()
   tomorrow=today+timedelta(days=1)
   page.locator('#timing').select_option('date')
   assert page.locator('#transport-date-field').is_visible()
   assert page.locator('#transport-date').get_attribute('min')==today.isoformat()
   assert page.locator('#message-fallback').is_hidden()
   page.locator('#send-button').click()
   assert page.evaluate('openedLinks.length')==1, 'Missing custom date must not open WhatsApp'
   page.locator('#transport-date').fill((today-timedelta(days=1)).isoformat())
   page.locator('#send-button').click()
   assert page.evaluate('openedLinks.length')==1, 'Past date must not open WhatsApp'
   page.locator('#transport-date').fill(tomorrow.isoformat())
   page.locator('#send-button').click()
   page.wait_for_function('openedLinks.length===2')
   assert 'Gewenste planning: '+tomorrow.strftime('%d-%m-%Y') in page.locator('#message-text').input_value()
   page.locator('#timing').select_option('week')
   assert page.locator('#transport-date-field').is_hidden()
   assert page.locator('#transport-date').is_disabled()
   assert page.locator('#transport-date').input_value()==''
   page.locator('#send-button').click()
   page.wait_for_function('openedLinks.length===3')
   assert 'Gewenste planning: Deze week' in page.locator('#message-text').input_value()
   assert tomorrow.strftime('%d-%m-%Y') not in page.locator('#message-text').input_value()
   page.locator('#timing').select_option('asap')

   page.locator('#plate').fill('xy-99-zz')
   assert page.locator('#vehicle').input_value()==''
   page.unroute('https://opendata.rdw.nl/**')
   page.route('https://opendata.rdw.nl/**',lambda route:route.fulfill(status=200,content_type='application/json',body='[]'))
   page.locator('#lookup-button').click()
   page.wait_for_function("document.getElementById('lookup-status').textContent.includes('Geen voertuig')")
   page.unroute('https://opendata.rdw.nl/**')
   page.route('https://opendata.rdw.nl/**',lambda route:route.abort())
   page.locator('#lookup-button').click()
   page.wait_for_function("document.getElementById('lookup-status').textContent.includes('Geen verbinding')")
   assert not errors,errors
   page.goto('http://127.0.0.1:8000/')
   page.screenshot(path=f'/tmp/detakelaar-{width}.png',full_page=True)
   print(f'PASS: {width}px — layout, contact links, RDW success/empty/network failure, stale data, verified-address WhatsApp payload, transport timing and date validation')
   page.close()
  page=browser.new_page(viewport={'width':1200,'height':630})
  page.goto('http://127.0.0.1:8000/assets/og.svg')
  page.screenshot(path=str(root/'assets/og.png'))
  page.close()
  browser.close()
finally:
 server.shutdown()
