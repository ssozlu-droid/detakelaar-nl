// Apple devices use Apple Maps; Android and desktop use Google Maps.
// Plain HTML links remain usable when JavaScript is unavailable.
export function prefersAppleMaps({userAgent = '', platform = '', maxTouchPoints = 0} = {}) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && maxTouchPoints > 1);
}
export function mapUrl(address, apple = false) {
  const url = new URL(apple ? 'https://maps.apple.com/' : 'https://www.google.com/maps/search/');
  if (apple) url.searchParams.set('q', address);
  else { url.searchParams.set('api', '1'); url.searchParams.set('query', address); }
  return url.href;
}
if (typeof document !== 'undefined') {
  const apple = prefersAppleMaps(navigator);
  for (const link of document.querySelectorAll('[data-map-address]')) {
    link.href = mapUrl(link.dataset.mapAddress, apple);
    const label = link.querySelector('[data-map-label]');
    if (label) label.textContent = apple ? 'Open in Apple Kaarten' : 'Open in Google Maps';
  }
}
