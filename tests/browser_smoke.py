"""Functional browser checks with deterministic RDW responses, not live API evidence."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
from functools import partial
from playwright.sync_api import sync_playwright
import json
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
   page.locator('#pickup').fill('Den Haag & Leiden')
   page.locator('#delivery').fill('Utrecht')
   page.locator('#name').fill('Test klant')
   page.locator('#phone').fill('0612345678')
   page.locator('#type').select_option(label='Schadevervoer')
   # Intercept the generated external link; do not submit an actual transport request.
   page.evaluate("window.openedLinks=[]; HTMLAnchorElement.prototype.click=function(){window.openedLinks.push(this.href);this.id='generated-whatsapp-link';document.body.append(this)}")
   page.locator('#send-button').click()
   page.wait_for_function('window.openedLinks.length > 0')
   link=page.locator('#generated-whatsapp-link').get_attribute('href')
   assert link.startswith('https://wa.me/31682990303?text=')
   assert 'Den Haag & Leiden' in page.locator('#message-text').input_value()
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
   print(f'PASS: {width}px — layout, contact links, RDW success/empty/network failure, stale data, WhatsApp payload')
   page.close()
  page=browser.new_page(viewport={'width':1200,'height':630})
  page.goto('http://127.0.0.1:8000/assets/og.svg')
  page.screenshot(path=str(root/'assets/og.png'))
  page.close()
  browser.close()
finally:
 server.shutdown()
