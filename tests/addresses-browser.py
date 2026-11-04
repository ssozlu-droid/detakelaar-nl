"""Address UI validation with simulated PDOK responses, not live-provider evidence."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse,parse_qs,unquote
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
s=ThreadingHTTPServer(('127.0.0.1',8002),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=s.serve_forever,daemon=True).start()
addresses=[{'id':'adr-'+'a'*32,'type':'adres','bron':'BAG','nummeraanduiding_id':'0344200000128086','huisnummer':93,'straatnaam':'Europalaan','woonplaatsnaam':'Utrecht','weergavenaam':'Europalaan 93, 3526KP Utrecht'}, {'id':'adr-'+'b'*32,'type':'adres','bron':'BAG','nummeraanduiding_id':'0344200000128087','huisnummer':95,'straatnaam':'Europalaan','woonplaatsnaam':'Utrecht','weergavenaam':'Europalaan 95, 3526KP Utrecht'}]
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [320,390,1440]:
   page=b.new_page(viewport={'width':width,'height':1000});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   mode={'value':'normal'};pending=[]
   def pdok(route):
    u=urlparse(route.request.url);params=parse_qs(u.query)
    if mode['value']=='offline':return route.abort()
    if u.path.endswith('/lookup'):
     docs=[a for a in addresses if a['id']==params.get('id',[''])[0]]
     if mode['value']=='pending':pending.append(route);return
     if mode['value']=='malformed':docs=[{**docs[0],'huisnummer':''}]
    else:
     assert params.get('fq')==['type:adres']
     docs=[] if 'poepstraat' in params.get('q',[''])[0] else addresses
    return route.fulfill(content_type='application/json',body=json.dumps({'response':{'docs':docs}}))
   page.route('https://api.pdok.nl/**',pdok)
   page.route('**/api/*.php',lambda r:r.fulfill(status=503,content_type='application/json',body='{"status":"unavailable"}'))
   page.goto('http://127.0.0.1:8002/')
   page.locator('#name').fill('Test');page.locator('#phone').fill('0612345678');page.locator('#type').select_option(label='Regulier autotransport');page.locator('#timing').select_option('asap')
   page.evaluate("window.openedLinks=[];HTMLAnchorElement.prototype.click=function(){if(this.href)window.openedLinks.push(this.href)}")
   page.locator('#pickup').fill('poepstraat 2423423')
   page.wait_for_function("document.getElementById('pickup-address-status').textContent.includes('Geen volledig adres')")
   page.locator('#delivery').fill('Europalaan 95')
   # Keyboard selection.
   page.wait_for_selector('#delivery-options [role=option]')
   page.locator('#delivery').press('ArrowDown');page.locator('#delivery').press('ArrowDown');page.locator('#delivery').press('Enter')
   page.wait_for_function("document.getElementById('delivery').value==='Europalaan 95, 3526KP Utrecht'")
   page.locator('#send-button').click()
   assert page.evaluate('openedLinks.length')==0,page.evaluate('openedLinks')
   assert not page.locator('#pickup').evaluate('(e)=>e.checkValidity()')
   # Pointer selection and exact canonical WhatsApp output.
   page.locator('#pickup').fill('Europalaan 93');page.locator('#pickup-options [role=option]').first.click()
   page.wait_for_function("document.getElementById('pickup').value==='Europalaan 93, 3526KP Utrecht'")
   page.locator('#send-button').click()
   page.wait_for_function('openedLinks.length===1')
   link=unquote(page.evaluate('openedLinks[0]'))
   assert addresses[0]['weergavenaam'] in link and addresses[1]['weergavenaam'] in link
   assert 'poepstraat' not in link
   # Editing a confirmed value removes confirmation and the previous message.
   page.locator('#pickup').fill('poepstraat 2423423')
   assert page.locator('#message-fallback').is_hidden()
   page.locator('#send-button').click();assert page.evaluate('openedLinks.length')==1
   # Lookup must have complete BAG data, not merely a suggestion label.
   mode['value']='malformed'
   page.locator('#pickup').fill('Europalaan 93');page.locator('#pickup-options [role=option]').first.click()
   page.wait_for_function("document.getElementById('pickup-address-status').dataset.state==='error'")
   page.locator('#send-button').click();assert page.evaluate('openedLinks.length')==1
   # In-flight lookup followed by editing cannot restore stale confirmation.
   mode['value']='pending';page.locator('#pickup').fill('Europalaan');page.locator('#pickup-options [role=option]').first.click()
   page.wait_for_timeout(100);assert pending
   page.locator('#pickup').fill('poepstraat 2423423')
   try:pending.pop().fulfill(content_type='application/json',body=json.dumps({'response':{'docs':[addresses[0]]}}))
   except Exception:pass
   page.wait_for_timeout(350)
   assert page.locator('#pickup').input_value()=='poepstraat 2423423'
   page.locator('#send-button').click();assert page.evaluate('openedLinks.length')==1
   mode['value']='offline';page.locator('#pickup').fill('Europalaan 93')
   page.wait_for_function("document.getElementById('pickup-address-status').dataset.state==='error'")
   page.locator('#send-button').click();assert page.evaluate('openedLinks.length')==1
   # A deliberate choice may finish validation after tabbing to the next field.
   mode['value']='pending';page.locator('#pickup').fill('Europalaan')
   page.locator('#pickup-options [role=option]').first.click();page.wait_for_timeout(100);assert pending
   page.locator('#name').focus()
   pending.pop().fulfill(content_type='application/json',body=json.dumps({'response':{'docs':[addresses[0]]}}))
   page.wait_for_function("document.getElementById('pickup').value==='Europalaan 93, 3526KP Utrecht'")
   assert page.locator('#pickup').evaluate('(e)=>e.checkValidity()')
   # Reopen the dropdown for a visual/layout check.

   mode['value']='normal';page.locator('#pickup').fill('Europalaan')
   page.wait_for_selector('#pickup-options [role=option]')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.locator('#name').focus();page.locator('#pickup').focus()
   page.wait_for_selector('#pickup-options [role=option]')
   page.locator('.request-card').screenshot(path=f'/tmp/address-form-{width}.png')
   assert not errors,errors
   print('PASS',width,'fake address blocked, keyboard/pointer selection, canonical WhatsApp, edit invalidation, malformed lookup, race, offline, layout')
   page.close()
  page=b.new_page(java_script_enabled=False);page.goto('http://127.0.0.1:8002/')
  assert page.locator('#send-button').is_disabled();print('PASS no JavaScript: send stays disabled')
  page=b.new_page()
  page.route('**/addresses.js',lambda r:r.abort())
  page.route('https://opendata.rdw.nl/**',lambda r:r.fulfill(content_type='application/json',body=json.dumps([{'kenteken':'AB12CD','merk':'TESTMERK','handelsbenaming':'Testmodel'}])))
  page.goto('http://127.0.0.1:8002/')
  page.wait_for_function("document.getElementById('request-status').textContent.includes('Adrescontrole kan niet')")
  assert page.locator('#send-button').is_disabled()
  page.locator('#plate').fill('AB12CD');page.locator('#lookup-button').click()
  page.wait_for_function("document.getElementById('vehicle').value==='TESTMERK Testmodel'")
  print('PASS missing address module: request disabled, RDW still works')
  b.close()
finally:s.shutdown()
