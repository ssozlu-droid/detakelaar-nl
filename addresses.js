const BASE = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/';
const ID = /^adr-[a-f0-9]{32}$/i;
export function addressSuggestions(data) {
  const docs = data?.response?.docs;
  if (!Array.isArray(docs) || docs.length > 100) throw new Error('Ongeldige adresgegevens');
  const seen = new Set();
  return docs.filter(doc => doc?.type === 'adres' && ID.test(doc.id) && typeof doc.weergavenaam === 'string'
    && doc.weergavenaam.trim() && doc.weergavenaam.length <= 200 && !seen.has(doc.id) && seen.add(doc.id)).slice(0, 5)
    .map(doc => ({id: doc.id, label: doc.weergavenaam.trim()}));
}
export function confirmedAddress(data, expectedId) {
  const docs = data?.response?.docs;
  if (!Array.isArray(docs) || docs.length !== 1) throw new Error('Kies opnieuw een volledig adres.');
  const doc = docs[0];
  if (!ID.test(expectedId) || doc.id !== expectedId || doc.type !== 'adres' || doc.bron !== 'BAG'
      || !/^\d{16}$/.test(doc.nummeraanduiding_id) || !/^\d+$/.test(String(doc.huisnummer)) || Number(doc.huisnummer) < 1
      || typeof doc.straatnaam !== 'string' || !doc.straatnaam.trim() || typeof doc.woonplaatsnaam !== 'string' || !doc.woonplaatsnaam.trim()
      || typeof doc.weergavenaam !== 'string' || !doc.weergavenaam.trim() || doc.weergavenaam.length > 200) {
    throw new Error('Dit is geen bevestigd volledig BAG-adres. Kies opnieuw.');
  }
  return Object.freeze({id: doc.id, label: doc.weergavenaam.trim(), bagId: doc.nummeraanduiding_id});
}
async function fetchAddress(path, parameters, signal) {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, {signal, mode:'cors', credentials:'omit', referrerPolicy:'no-referrer'});
  if (!response.ok) throw new Error('Adresdienst niet bereikbaar');
  return response.json();
}
export function initAddressFields(inputs, onChange = () => {}) {
  const controls = inputs.map(input => {
    const wrapper = input.parentElement;
    wrapper.classList.add('address-field');
    const list = document.createElement('ul');
    list.id = `${input.id}-options`; list.className = 'address-options'; list.setAttribute('role','listbox'); list.hidden = true;
    const status = document.createElement('p');
    status.id = `${input.id}-address-status`; status.className = 'address-status'; status.setAttribute('role','status');
    status.textContent = 'Typ straat, huisnummer en plaats of postcode. Kies daarna een adres.';
    wrapper.append(list,status);
    input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-expanded','false'); input.setAttribute('aria-controls',list.id);
    input.setAttribute('aria-describedby',status.id); input.setAttribute('spellcheck','false');
    let selected = null, candidates = [], active = -1, version = 0, timer, controller, choosing = false;
    const validityMessage = 'Kies een bestaand adres met huisnummer uit de suggesties.';
    input.setCustomValidity(validityMessage);
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const say = (text, state = '') => { status.textContent = text; status.dataset.state = state; };
    const cancel = () => { clearTimeout(timer); controller?.abort(); controller = null; input.removeAttribute('aria-busy'); };
    const highlight = index => {
      active = index;
      [...list.children].forEach((item,i) => item.setAttribute('aria-selected',String(i===index)));
      if (index >= 0) { input.setAttribute('aria-activedescendant',list.children[index].id); list.children[index].scrollIntoView({block:'nearest'}); }
      else input.removeAttribute('aria-activedescendant');
    };
    const choose = async index => {
      const candidate = candidates[index]; if (!candidate) return;
      cancel(); choosing = true; const requestVersion = ++version; const query = input.value;
      controller = new AbortController(); const current = controller;
      const timeout = setTimeout(() => current.abort(),8000);
      close(); selected = null; input.setCustomValidity(validityMessage);
      input.setAttribute('aria-busy','true'); say('Adres controleren…');
      try {
        const data = await fetchAddress('lookup',{id:candidate.id,fl:'id,type,bron,weergavenaam,straatnaam,huisnummer,woonplaatsnaam,nummeraanduiding_id'},current.signal);
        if (version !== requestVersion || input.value !== query) return;
        selected = confirmedAddress(data,candidate.id); input.value = selected.label;
        input.setCustomValidity(''); say('Adres geselecteerd uit de BAG.','valid'); onChange();
      } catch (error) {
        if (version !== requestVersion) return;
        selected = null; input.setCustomValidity(validityMessage);
        say(error.message.startsWith('Dit is geen') || error.message.startsWith('Kies opnieuw') ? error.message : 'Adres controleren lukt niet. Probeer opnieuw of bel ons.','error');
      } finally { clearTimeout(timeout); if (version === requestVersion) { choosing = false; input.removeAttribute('aria-busy'); } }
    };
    const search = async (query, requestVersion) => {
      if (version !== requestVersion || input.value.trim() !== query) return;
      controller = new AbortController(); const current = controller;
      const timeout = setTimeout(() => current.abort(),8000);
      input.setAttribute('aria-busy','true'); say('Bestaande adressen zoeken…');
      try {
        const data = await fetchAddress('suggest',{q:query,fq:'type:adres',rows:'5',fl:'id,type,weergavenaam'},current.signal);
        if (version !== requestVersion || input.value.trim() !== query || document.activeElement !== input) return;
        candidates = addressSuggestions(data); list.replaceChildren(); active = -1;
        candidates.forEach((candidate,index) => {
          const option = document.createElement('li'); option.id = `${input.id}-option-${index}`;
          option.setAttribute('role','option'); option.setAttribute('aria-selected','false'); option.textContent = candidate.label;
          option.addEventListener('pointerdown',event=>event.preventDefault());
          option.addEventListener('click',()=>choose(index)); list.append(option);
        });
        list.hidden = !candidates.length; input.setAttribute('aria-expanded',String(candidates.length>0));
        say(candidates.length ? `${candidates.length} adressen gevonden. Kies het juiste adres.` : 'Geen volledig adres gevonden. Voeg huisnummer, plaats of postcode toe.');
      } catch {
        if (version !== requestVersion) return;
        close(); say('Adreszoeken is niet bereikbaar. Probeer opnieuw of bel ons.','error');
      } finally { clearTimeout(timeout); if (version === requestVersion) input.removeAttribute('aria-busy'); }
    };
    const schedule = () => {
      cancel(); choosing = false; const requestVersion = ++version;
      selected = null; candidates = []; close(); list.replaceChildren();
      input.setCustomValidity(validityMessage); onChange();
      const query = input.value.trim();
      if (query.length < 3) { say('Typ minimaal drie tekens en voeg je huisnummer toe.'); return; }
      timer = setTimeout(()=>search(query,requestVersion),300);
    };
    input.addEventListener('input',schedule);
    input.addEventListener('focus',()=>{ if (!selected && !choosing && input.value.trim().length >= 3) schedule(); });
    input.addEventListener('blur',()=>{ if (!choosing) { cancel(); version++; } close(); });
    input.addEventListener('keydown',event=>{
      if (event.key==='Escape') { cancel(); choosing = false; version++; close(); say(validityMessage); return; }
      if (list.hidden || !candidates.length) return;
      if (event.key==='ArrowDown' || event.key==='ArrowUp') {
        event.preventDefault(); const step=event.key==='ArrowDown'?1:-1;
        highlight((active+step+candidates.length)%candidates.length);
      } else if (event.key==='Enter' && active>=0) { event.preventDefault(); choose(active); }
    });
    return {input, get value() { return selected && input.value===selected.label ? selected.label : null; },
      report() { input.setCustomValidity(validityMessage); say(validityMessage,'error'); input.focus(); input.reportValidity(); }};
  });
  return {values() {
    const invalid = controls.find(control=>!control.value);
    if (invalid) { invalid.report(); return null; }
    return Object.fromEntries(controls.map(control=>[control.input.name,control.value]));
  }};
}
