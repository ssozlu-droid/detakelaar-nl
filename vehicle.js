export function normalizePlate(value) { return String(value).toUpperCase().replace(/[\s-]/g, ''); }
export function validPlate(value) { return /^[A-Z0-9]{4,8}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value); }
export function formatRdwDate(value) {
  if (!/^\d{8}$/.test(value || '')) return 'Niet beschikbaar';
  const y = +value.slice(0,4), m = +value.slice(4,6), d = +value.slice(6,8);
  const date = new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d ? `${value.slice(6,8)}-${value.slice(4,6)}-${value.slice(0,4)}` : 'Niet beschikbaar';
}
// This provider boundary permits a future server-side Finnik adapter without changing the form.
export async function lookupRdw(plate, {fetcher = fetch, signal} = {}) {
  const normalized = normalizePlate(plate);
  if (!validPlate(normalized)) throw new Error('Vul een geldig Nederlands kenteken in, bijvoorbeeld AB-12-CD.');
  const url = new URL('https://opendata.rdw.nl/resource/m9d7-ebf2.json');
  url.searchParams.set('kenteken', normalized);
  const response = await fetcher(url, {signal, headers: {Accept:'application/json'}});
  if (!response.ok) throw new Error('De RDW is momenteel niet bereikbaar. Probeer het later opnieuw of vul je aanvraag handmatig in.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('De RDW gaf geen bruikbaar antwoord. Vul je aanvraag handmatig in.');
  const row = rows.find(item => item && item.kenteken === normalized);
  if (!row) throw new Error('Geen voertuig gevonden bij de RDW. Controleer het kenteken of vul de aanvraag handmatig in.');
  return {plate:normalized,brand:row.merk || '',model:row.handelsbenaming || '',date:formatRdwDate(row.datum_eerste_toelating),kind:row.voertuigsoort || '',emptyMass:row.massa_ledig_voertuig || '',maxMass:row.toegestane_maximum_massa_voertuig || ''};
}
export function amsterdamToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function transportTimingLabel(data, today = amsterdamToday()) {
  if (data.timing === 'asap') return 'Zo snel mogelijk';
  if (data.timing === 'week') return 'Deze week';
  if (data.timing !== 'date') throw new Error('Kies wanneer je het transport wilt.');
  const value = String(data.transportDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Kies een geldige transportdatum.');
  const [year,month,day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year,month-1,day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month-1 || date.getUTCDate() !== day) throw new Error('Kies een geldige transportdatum.');
  if (value < today) throw new Error('Kies vandaag of een datum in de toekomst.');
  return `${value.slice(8,10)}-${value.slice(5,7)}-${value.slice(0,4)}`;
}
export function buildMessage(data) {
  const value = key => String(data[key] || '').trim() || 'Niet opgegeven';
  const timing = data.timing ? transportTimingLabel(data) : 'Niet opgegeven';
  return `*Nieuwe transportaanvraag — DeTakelaar.nl*\n\nKenteken: ${value('plate')}\nVoertuig: ${value('vehicle')}\nOphaallocatie: ${value('pickup')}\nAfleverlocatie: ${value('delivery')}\nType transport: ${value('type')}\nGewenste planning: ${timing}\nNaam klant: ${value('name')}\nTelefoonnummer: ${value('phone')}\nBijzonderheden: ${value('notes')}`;
}
