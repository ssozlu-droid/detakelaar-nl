const SVG = 'http://www.w3.org/2000/svg';
const MAX_TRAFFIC_AGE = 300_000;
const MAX_NEWS_AGE = 72 * 60 * 60 * 1000;

export function projectTrafficPoint(point) {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) return null;
  const [lon, lat] = point;
  if (lon < 3.1 || lon > 7.4 || lat < 50.6 || lat > 53.8) return null;
  const merc = degrees => Math.log(Math.tan(Math.PI / 4 + degrees * Math.PI / 360)) * 180 / Math.PI;
  return [540 + (lon - 3.2) * 175, 65 + (merc(53.65) - merc(lat)) * 175];
}
export function trafficIsFresh(data, now = Date.now()) {
  const updated = Date.parse(data?.sourceUpdatedAt);
  const expires = Date.parse(data?.expiresAt);
  return data?.status === 'ok' && Number.isFinite(updated) && updated <= now + 120_000
    && now - updated <= MAX_TRAFFIC_AGE && Number.isFinite(expires) && expires > now
    && expires <= updated + MAX_TRAFFIC_AGE && Array.isArray(data.jams) && data.jams.length <= 2000;
}
export function recentNews(data, now = Date.now()) {
  if (data?.status !== 'ok' || !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= now
      || Date.parse(data.expiresAt) > Date.parse(data.checkedAt) + 1_200_000 || !Number.isFinite(Date.parse(data.checkedAt))
      || Date.parse(data.checkedAt) > now + 120_000 || now - Date.parse(data.checkedAt) > 1_200_000
      || !Array.isArray(data.articles)) throw new Error('Stale news response');
  const seen = new Set();
  return data.articles.filter(article => {
    try {
      const url = new URL(article.url);
      const published = Date.parse(article.publishedAt);
      if (url.protocol !== 'https:' || !['www.nu.nl', 'nu.nl'].includes(url.hostname) || url.username || url.password || url.port
          || typeof article.title !== 'string' || !article.title.trim() || article.title.length > 500
          || !Number.isFinite(published) || published > now + 120_000 || now - published > MAX_NEWS_AGE || seen.has(url.href)) return false;
      seen.add(url.href); return true;
    } catch { return false; }
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
}
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
const clock = date => new Intl.DateTimeFormat('nl-NL', {timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit'}).format(date);
const articleDate = date => new Intl.DateTimeFormat('nl-NL', {timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(date);

export function initLiveUpdates() {
  const section = document.getElementById('actueel');
  if (!section) return;
  const trafficStatus = section.querySelector('[data-traffic-status]');
  const trafficTime = section.querySelector('[data-traffic-time]');
  const trafficList = section.querySelector('[data-traffic-list]');
  const newsStatus = section.querySelector('[data-news-status]');
  const newsList = section.querySelector('[data-news-list]');
  const backdrop = document.querySelector('[data-traffic-background]');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 1440 1100');
  svg.setAttribute('aria-hidden', 'true');
  backdrop.append(svg);
  let trafficExpiry = 0;
  let newsExpiry = 0;
  let articleExpiry = 0;
  let trafficBusy = false;
  let newsBusy = false;
  let trafficChecked = 0;
  let newsChecked = 0;
  const smallScreen = matchMedia('(max-width:650px)');
  const alignMap = () => {
    const width = document.documentElement.clientWidth;
    const mobile = smallScreen.matches;
    const scale = mobile ? 640 / 1100 : Math.max(width / 1440, innerHeight / 1100);
    const mapWidth = 1440 * scale;
    backdrop.classList.toggle('traffic-background-mobile', mobile);
    svg.style.width = `${mapWidth}px`;
    svg.style.height = `${1100 * scale}px`;
    svg.style.left = `${mobile ? (width - mapWidth) * .72 : (width - mapWidth) / 2 - 100}px`;
    svg.style.top = mobile ? '90px' : '0';
  };
  addEventListener('resize', alignMap, {passive: true});
  smallScreen.addEventListener('change', alignMap);
  alignMap();
  const clearTraffic = () => {
    svg.replaceChildren();
    trafficExpiry = 0;
    trafficList.replaceChildren();
    trafficStatus.textContent = 'Verkeersinformatie tijdelijk niet beschikbaar';
    trafficStatus.dataset.state = 'unavailable';
    trafficTime.textContent = 'De gouden kaart blijft zichtbaar. Er worden geen oude filemeldingen getoond.';
  };
  const clearNews = () => {
    newsList.replaceChildren();
    newsStatus.textContent = 'Nieuws kan op dit moment niet worden opgehaald. Bekijk de laatste berichten bij de bron.';
    newsExpiry = 0; articleExpiry = 0;
  };
  const fetchJSON = async url => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {signal: controller.signal, cache: 'no-store', credentials: 'same-origin'});
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Feed unavailable');
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error('Oversized feed');
      return JSON.parse(text);
    } finally { clearTimeout(timeout); }
  };
  const renderTraffic = data => {
    if (!trafficIsFresh(data)) throw new Error('Stale traffic response');
    const graphics = document.createDocumentFragment();
    const list = document.createDocumentFragment();
    let drawn = 0;
    for (const report of data.jams) {
      const geometry = report?.geometry;
      if (!geometry) continue;
      let shape;
      if (geometry.type === 'Point') {
        const point = projectTrafficPoint(geometry.coordinates);
        if (!point) continue;
        shape = document.createElementNS(SVG, 'circle');
        shape.setAttribute('cx', point[0].toFixed(2)); shape.setAttribute('cy', point[1].toFixed(2));
        shape.setAttribute('r', '3.5'); shape.setAttribute('class', 'traffic-point');
      } else if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates) && geometry.coordinates.length <= 100) {
        const paths = [];
        for (const line of geometry.coordinates) {
          if (!Array.isArray(line) || line.length < 2 || line.length > 2000) continue;
          const points = line.map(projectTrafficPoint);
          if (points.some(point => point === null)) continue;
          paths.push('M' + points.map(p => p.map(v => v.toFixed(2)).join(',')).join('L'));
        }
        if (!paths.length) continue;
        shape = document.createElementNS(SVG, 'path');
        shape.setAttribute('d', paths.join('')); shape.setAttribute('class', 'traffic-segment');
      } else continue;
      const road = typeof report.road === 'string' && /^[AN]\d{1,3}$/.test(report.road) ? report.road : 'Filemelding';
      const kind = {stationaryTraffic: 'stilstaand verkeer', queuingTraffic: 'file', slowTraffic: 'langzaam verkeer', trafficCongestion: 'file'}[report.type] || 'file';
      const title = document.createElementNS(SVG, 'title'); title.textContent = `${road}: ${kind}`;
      shape.append(title); graphics.append(shape); drawn++;
      if (drawn <= 5) list.append(node('li', '', `${road} · ${kind}${geometry.type === 'Point' ? ' (puntmelding)' : ''}`));
    }
    svg.replaceChildren(graphics); trafficList.replaceChildren(list);
    trafficExpiry = Date.parse(data.expiresAt);
    trafficStatus.dataset.state = 'current';
    trafficStatus.textContent = drawn ? `${drawn} filelocatie${drawn === 1 ? '' : 's'} op de kaart` : 'Geen tekenbare filemeldingen in deze bronupdate';
    trafficTime.textContent = `Bron NDW · bijgewerkt ${clock(new Date(data.sourceUpdatedAt))} · controle elke minuut`;
    if (Number.isInteger(data.unmappedReports) && data.unmappedReports > 0) {
      trafficTime.textContent += ` · ${data.unmappedReports} melding${data.unmappedReports === 1 ? '' : 'en'} zonder bruikbare kaartlocatie`;
    }
  };
  const renderNews = data => {
    const articles = recentNews(data);
    const cards = document.createDocumentFragment();
    for (const article of articles) {
      const card = node('article', 'news-card');
      const time = node('time', '', articleDate(new Date(article.publishedAt))); time.dateTime = article.publishedAt;
      const heading = node('h3'); const link = node('a', '', article.title);
      link.href = article.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const source = node('span', 'news-source', 'NU.nl Auto');
      const arrow = document.createElementNS(SVG, 'svg');
      arrow.setAttribute('viewBox', '0 0 24 24'); arrow.setAttribute('width', '13'); arrow.setAttribute('height', '13');
      arrow.setAttribute('fill', 'none'); arrow.setAttribute('stroke', 'currentColor'); arrow.setAttribute('stroke-width', '1.6'); arrow.setAttribute('aria-hidden', 'true');
      const line = document.createElementNS(SVG, 'path'); line.setAttribute('d', 'M7 17 17 7M7 7h10v10'); arrow.append(line); source.append(arrow);
      heading.append(link); card.append(time, heading, source); cards.append(card);
    }
    newsList.replaceChildren(cards);
    newsExpiry = Date.parse(data.expiresAt);
    articleExpiry = articles.length ? Math.min(...articles.map(a => Date.parse(a.publishedAt) + MAX_NEWS_AGE)) : 0;
    newsStatus.textContent = articles.length ? `Recente koppen van NU.nl Auto · gecontroleerd ${clock(new Date(data.checkedAt))}` : 'Op dit moment staan er geen berichten van de afgelopen drie dagen in deze feed.';
  };
  const updateTraffic = async () => {
    if (trafficBusy || document.hidden) return;
    trafficBusy = true; trafficChecked = Date.now();
    try { renderTraffic(await fetchJSON('api/traffic.php')); } catch { clearTraffic(); }
    finally { trafficBusy = false; }
  };
  const updateNews = async () => {
    if (newsBusy || document.hidden) return;
    newsBusy = true; newsChecked = Date.now();
    try { renderNews(await fetchJSON('api/news.php')); } catch { clearNews(); }
    finally { newsBusy = false; }
  };
  const checkExpiry = () => {
    if (trafficExpiry && Date.now() >= trafficExpiry) clearTraffic();
    if ((newsExpiry && Date.now() >= newsExpiry) || (articleExpiry && Date.now() >= articleExpiry)) clearNews();
  };
  setInterval(checkExpiry, 5000);
  setInterval(updateTraffic, 60_000);
  setInterval(updateNews, 600_000);
  document.addEventListener('visibilitychange', () => {
    checkExpiry();
    if (Date.now() - trafficChecked >= 60_000) updateTraffic();
    if (Date.now() - newsChecked >= 600_000) updateNews();
  });
  updateTraffic(); updateNews();
}
if (typeof document !== 'undefined') initLiveUpdates();
