import {normalizePlate, lookupRdw, buildMessage} from './vehicle.js';
import {contact} from './config.js';
const $ = id => document.getElementById(id);
const phoneReady = /^\+[1-9]\d{7,14}$/.test(contact.phone);
const whatsappReady = /^[1-9]\d{7,14}$/.test(contact.whatsapp);
const icons = {
 tel:'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 3l3 5-2 2c1 3 3 5 6 6l2-2 5 3c-1 5-5 5-10 2S2 9 3 6z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
 whatsapp:'<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 17a9 9 0 1 1 4 4l-5 1z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7c-2 2 3 8 6 8 1 0 2-2 1-2l-2-1-1 1-2-2 1-1-1-3z" fill="currentColor"/></svg>'
};
for (const link of document.querySelectorAll('[data-contact]')) {
 const tel = link.dataset.contact === 'tel';
 link.hidden = !(tel ? phoneReady : whatsappReady);
 link.href = tel ? `tel:${contact.phone}` : `https://wa.me/${contact.whatsapp}`;
 link.innerHTML = icons[tel ? 'tel' : 'whatsapp'] + (tel ? 'Bel ons' : 'WhatsApp');
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
let addresses = null;
import('./addresses.js').then(({initAddressFields}) => {
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
 const message=buildMessage(data);$('message-text').value=message;$('message-fallback').hidden=false;
 if(whatsappReady){const a=document.createElement('a');a.href=`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;a.target='_blank';a.rel='noopener noreferrer';a.click();$('request-status').textContent='Je aanvraag staat klaar in WhatsApp. Verstuur daar zelf het bericht. Opent WhatsApp niet? Kopieer de tekst hieronder.';}
 else {try{await navigator.clipboard.writeText(message);$('request-status').textContent='Aanvraag gekopieerd. Bewaar deze tot het contactnummer beschikbaar is.';}catch{$('request-status').textContent='Kopieer je aanvraag uit het tekstvak hieronder.';$('message-text').focus();$('message-text').select();}}
});
