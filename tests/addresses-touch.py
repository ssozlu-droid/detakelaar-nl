"""Touch regression tests, including legacy Safari's blur-before-click ordering.
Uses Chromium touch emulation and explicit TouchEvents, not a physical iPhone.
PDOK responses are simulated; no WhatsApp message is sent.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',8004),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
addresses=[{'id':'adr-'+'a'*32,'type':'adres','bron':'BAG','nummeraanduiding_id':'0344200000128086','huisnummer':93,'straatnaam':'Europalaan','woonplaatsnaam':'Utrecht','weergavenaam':'Europalaan 93, 3526KP Utrecht'},{'id':'adr-'+'b'*32,'type':'adres','bron':'BAG','nummeraanduiding_id':'0344200000128087','huisnummer':95,'straatnaam':'Europalaan','woonplaatsnaam':'Utrecht','weergavenaam':'Europalaan 95, 3526KP Utrecht'}]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':375,'height':667},is_mobile=True,has_touch=True,device_scale_factor=2,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 Version/16.7 Mobile/15E148 Safari/604.1')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  lookups=[]
  def pdok(route):
   u=urlparse(route.request.url);params=parse_qs(u.query)
   if u.path.endswith('/lookup'):
    lookups.append(params['id'][0]);docs=[a for a in addresses if a['id']==params['id'][0]]
   else:docs=addresses
   route.fulfill(content_type='application/json',body=json.dumps({'response':{'docs':docs}}))
  page.route('https://api.pdok.nl/**',pdok)
  page.route('**/api/*.php',lambda r:r.fulfill(status=503,content_type='application/json',body='{"status":"unavailable"}'))
  page.goto('http://127.0.0.1:8004/')
  page.locator('#pickup').fill('Europalaan')
  page.wait_for_selector('#pickup-options [role=option]')
  # No PointerEvent or synthetic click: touch starts, the keyboard blurs/reflows,
  # then touchend must still confirm the original option once.
  page.evaluate('''()=>{
   const input=document.getElementById('pickup'),option=document.querySelector('#pickup-options [role=option]');
   const r=option.getBoundingClientRect();
   const t=new Touch({identifier:1,target:option,clientX:r.left+20,clientY:r.top+15});
   option.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}));
   input.blur();
   if(option.closest('ul').hidden)throw new Error('Blur hid the list before touchend');
   option.parentElement.style.transform='translateY(40px)';
   input.focus();
   option.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[t]}));
   option.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
   option.parentElement.style.transform='';
  }''')
  page.wait_for_function("document.getElementById('pickup').value==='Europalaan 93, 3526KP Utrecht'")
  assert lookups==[addresses[0]['id']],lookups
  assert page.locator('#pickup').evaluate('(e)=>e.checkValidity()')
  print('PASS legacy touch order: blur/reflow before touchend, no click required, no duplicate lookup')
  # A scroll gesture must never select an address.
  page.locator('#delivery').fill('Europalaan');page.wait_for_selector('#delivery-options [role=option]')
  page.evaluate('''()=>{
   const o=document.querySelector('#delivery-options [role=option]'),r=o.getBoundingClientRect();
   const t=y=>new Touch({identifier:2,target:o,clientX:r.left+20,clientY:y});
   o.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t(r.top+15)],changedTouches:[t(r.top+15)]}));
   o.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[t(r.top+35)],changedTouches:[t(r.top+35)]}));
   o.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[t(r.top+35)]}));
   o.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  }''')
  assert len(lookups)==1
  assert not page.locator('#delivery').evaluate('(e)=>e.checkValidity()')
  print('PASS scroll plus delayed click does not select an address')
  # A real emulated tap must work too, immediately after scrolling.
  page.locator('#delivery-options [role=option]').nth(1).tap()
  page.wait_for_function("document.getElementById('delivery').value==='Europalaan 95, 3526KP Utrecht'")
  assert len(lookups)==2,lookups
  page.locator('#name').fill('Test');page.locator('#phone').fill('0612345678')
  page.locator('#type').select_option(label='Regulier autotransport');page.locator('#timing').select_option('asap')
  page.evaluate("window.openedLinks=[];HTMLAnchorElement.prototype.click=function(){if(this.href&&this.href.startsWith('https://wa.me/'))window.openedLinks.push(this.href)}")
  page.locator('#send-button').tap();page.wait_for_function('openedLinks.length===1')
  assert addresses[0]['weergavenaam'] in page.locator('#message-text').input_value()
  assert addresses[1]['weergavenaam'] in page.locator('#message-text').input_value()
  page.locator('#pickup').fill('poepstraat 2423423')
  page.locator('#send-button').tap();assert page.evaluate('openedLinks.length')==1
  assert not errors,errors
  print('PASS touch selection for both addresses, WhatsApp with confirmed addresses, edited address still blocked')
  browser.close()
finally:server.shutdown()
