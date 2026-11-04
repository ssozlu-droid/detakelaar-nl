import {normalizePlate, lookupRdw, buildMessage, amsterdamToday, transportTimingLabel} from './vehicle.js?v=20261104-timing';
import {contact} from './config.js';
const $ = id => document.getElementById(id);
const phoneReady = /^\+[1-9]\d{7,14}$/.test(contact.phone);
const whatsappReady = /^[1-9]\d{7,14}$/.test(contact.whatsapp);
// WhatsApp: Simple Icons 11.15.0 (CC0); phone: Feather 4.29.2 (MIT, notice below).
const icons = {
 tel:'<svg class="contact-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
 whatsapp:'<svg class="contact-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" preserveAspectRatio="xMidYMid meet" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>'
};
for (const link of document.querySelectorAll('[data-contact]')) {
 const tel = link.dataset.contact === 'tel';
 link.hidden = !(tel ? phoneReady : whatsappReady);
 link.href = tel ? `tel:${contact.phone}` : `https://wa.me/${contact.whatsapp}`;
 link.innerHTML = icons[tel ? 'tel' : 'whatsapp'] + '<span class="contact-label">' + (tel ? 'Bel ons' : 'WhatsApp') + '</span>';
 if (!tel) {link.target = '_blank';link.rel = 'noopener noreferrer';}
}
$('contact-notice').hidden = phoneReady && whatsappReady;
if (phoneReady) {
 const phone = document.createElement('a'); phone.href = `tel:${contact.phone}`;phone.textContent = contact.display;
 const line = document.createElement('p');line.append('Liever even overleggen? ',phone);$('contact-notice').after(line);
}
$('send-button').textContent = whatsappReady ? 'Verstuur via WhatsApp' : 'Aanvraag kopiëren';
$('year').textContent = new Date().getFullYear();
let currentController;
function clearVehicle() { $('vehicle-result').hidden = true; $('vehicle-result').replaceChildren(); $('vehicle').value = ''; }
$('plate').addEventListener('input', () => { currentController?.abort();clearVehicle();$('lookup-status').textContent='';$('request-plate').value = normalizePlate($('plate').value); });
$('request-plate').addEventListener('input', () => { $('vehicle').value=''; });
$('lookup-form').addEventListener('submit', async event => {
 event.preventDefault();currentController?.abort();
 const controller = new AbortController();currentController = controller;
 const timer = setTimeout(() => controller.abort(), 12000);
 const button = $('lookup-button'), status = $('lookup-status');
 clearVehicle();button.disabled = true;button.textContent = 'Voertuig zoeken…';status.dataset.error='false';status.textContent='Gegevens ophalen bij de RDW…';$('lookup-form').setAttribute('aria-busy','true');
 try {
  const vehicle = await lookupRdw($('plate').value,{signal:controller.signal});
  if(currentController !== controller) return;
  $('request-plate').value=vehicle.plate;$('vehicle').value=[vehicle.brand,vehicle.model].filter(Boolean).join(' ');
  const rows=[['Merk',vehicle.brand],['Model',vehicle.model],['Eerste toelating',vehicle.date],['Voertuigsoort',vehicle.kind],['Massa ledig',vehicle.emptyMass ? `${vehicle.emptyMass} kg` : ''],['Toegestane maximummassa',vehicle.maxMass ? `${vehicle.maxMass} kg` : '']];
  for(const [label,value] of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value || 'Niet beschikbaar';$('vehicle-result').append(dt,dd);}
  $('vehicle-result').hidden=false;status.textContent='Voertuig gevonden. Vul hieronder je transportaanvraag in.';
  const next = document.createElement('a');next.href='#aanvraag';next.className='button full';next.textContent='Verder met aanvraag';$('vehicle-result').append(next);
 } catch(error) {
  if(currentController !== controller) return;
  status.dataset.error='true';status.textContent=error.name==='AbortError' ? 'Het zoeken is onderbroken of duurt te lang. Probeer opnieuw of vul je aanvraag handmatig in.' : error instanceof TypeError ? 'Geen verbinding met de RDW. Controleer je internetverbinding of vul je aanvraag handmatig in.' : error.message;
 } finally {clearTimeout(timer);if(currentController===controller){button.disabled=false;button.textContent='Zoek voertuig';$('lookup-form').removeAttribute('aria-busy');}}
});
const timingInput = $('timing'), dateInput = $('transport-date');
function refreshDateMinimum() { dateInput.min=amsterdamToday(); }
function updateTiming() {
 timingInput.setCustomValidity('');
 const custom = timingInput.value==='date';
 $('transport-date-field').hidden=!custom;dateInput.disabled=!custom;dateInput.required=custom;
 dateInput.setCustomValidity('');
 if(!custom) dateInput.value='';
 refreshDateMinimum();
 $('message-text').value='';$('message-fallback').hidden=true;$('request-status').textContent='';
}
timingInput.addEventListener('change',updateTiming);
dateInput.addEventListener('focus',refreshDateMinimum);
dateInput.addEventListener('input',()=>{dateInput.setCustomValidity('');$('message-text').value='';$('message-fallback').hidden=true;$('request-status').textContent='';});
updateTiming();
let addresses = null;
import('./addresses.js?v=20261104-touch').then(({initAddressFields}) => {
 addresses = initAddressFields([$('pickup'),$('delivery')], () => {
  $('message-text').value='';$('message-fallback').hidden=true;$('request-status').textContent='';
 });
 $('send-button').disabled=false;
}).catch(() => {
 $('request-status').textContent='Adrescontrole kan niet worden geladen. Vernieuw de pagina of bel ons voor je aanvraag.';
});
$('request-form').addEventListener('submit', async event => {
 event.preventDefault();if(!addresses){$('request-status').textContent='Adrescontrole is nog niet beschikbaar. Bel ons voor je aanvraag.';return;}const verified=addresses.values();if(!verified){$('request-status').textContent='Selecteer voor ophalen en afleveren een bestaand adres met huisnummer.';return;}const data={...Object.fromEntries(new FormData(event.currentTarget)),...verified};
 for(const key of ['pickup','delivery','name','phone','type']) {if(!String(data[key]||'').trim()){$('request-status').textContent='Vul alle verplichte velden in.';return;}}
 refreshDateMinimum();
 try { transportTimingLabel(data); }
 catch(error) {const field=timingInput.value==='date'?dateInput:timingInput;field.setCustomValidity(error.message);field.reportValidity();$('request-status').textContent=error.message;return;}
 timingInput.setCustomValidity('');
 const message=buildMessage(data);$('message-text').value=message;$('message-fallback').hidden=false;
 if(whatsappReady){const a=document.createElement('a');a.href=`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;a.target='_blank';a.rel='noopener noreferrer';a.click();$('request-status').textContent='Je aanvraag staat klaar in WhatsApp. Verstuur daar zelf het bericht. Opent WhatsApp niet? Kopieer de tekst hieronder.';}
 else {try{await navigator.clipboard.writeText(message);$('request-status').textContent='Aanvraag gekopieerd. Bewaar deze tot het contactnummer beschikbaar is.';}catch{$('request-status').textContent='Kopieer je aanvraag uit het tekstvak hieronder.';$('message-text').focus();$('message-text').select();}}
});

/* Phone SVG icon license (Feather):
The MIT License (MIT)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
