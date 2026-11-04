// This index uses exactly the vertices drawn in assets/netherlands-roads.svg.
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const interpolate = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const key = p => p.join(',');
const validPoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

export function roadDataFromPaths(paths) {
  const routes = {}, seen = new Set();
  for (const {road, d} of paths) {
    if (!/^[AN]\d{1,3}$/.test(road) || typeof d !== 'string' || seen.has(road + d)) continue;
    seen.add(road + d);
    const lines = d.split('M').filter(Boolean).map(part => part.split('L').map(pair => pair.split(',').map(Number)));
    if (lines.some(line => line.length < 2 || line.some(point => !validPoint(point)))) throw new Error('Invalid map road');
    (routes[road] ||= []).push(...lines);
  }
  if (!routes.A4 || !routes.A12) throw new Error('Map roads missing');
  return {version: 1, routes};
}
export function createRoadIndex(data) {
  if (data?.version !== 1 || !data.routes || Object.keys(data.routes).length > 1000) throw new Error('Invalid road data');
  const routes = new Map();
  for (const [road, lines] of Object.entries(data.routes)) {
    if (!/^[AN]\d{1,3}$/.test(road) || !Array.isArray(lines)) continue;
    const edges = [], nodes = new Map();
    const attach = (id, link) => { if (!nodes.has(id)) nodes.set(id, []); nodes.get(id).push(link); };
    for (const points of lines) {
      if (!Array.isArray(points) || points.length < 2 || !points.every(validPoint)) continue;
      const along = [0];
      for (let i = 1; i < points.length; i++) along.push(along[i - 1] + distance(points[i - 1], points[i]));
      const length = along.at(-1);
      if (!length) continue;
      const edge = {points, along, length, u: key(points[0]), v: key(points.at(-1))};
      edges.push(edge);
      attach(edge.u, {edge, to: edge.v, reverse: false}); attach(edge.v, {edge, to: edge.u, reverse: true});
    }
    routes.set(road, {edges, nodes});
  }
  return routes;
}
function nearest(route, point, tolerance) {
  let best = null, bestDistance = tolerance;
  for (const edge of route.edges) {
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i - 1], b = edge.points[i], dx = b[0] - a[0], dy = b[1] - a[1];
      const squared = dx * dx + dy * dy;
      if (!squared) continue;
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared));
      const projected = interpolate(a, b, t), d = distance(projected, point);
      if (d <= bestDistance) { bestDistance = d; best = {edge, point: projected, at: edge.along[i - 1] + t * Math.sqrt(squared)}; }
    }
  }
  return best;
}
function slice(edge, from, to) {
  if (from > to) return slice(edge, to, from).reverse();
  const pointAt = at => {
    for (let i = 1; i < edge.points.length; i++) {
      if (edge.along[i] >= at) return interpolate(edge.points[i - 1], edge.points[i],
        (at - edge.along[i - 1]) / (edge.along[i] - edge.along[i - 1] || 1));
    }
    return edge.points.at(-1);
  };
  return [pointAt(from), ...edge.points.filter((_, i) => edge.along[i] > from && edge.along[i] < to), pointAt(to)];
}
// Small binary heap keeps long national routes responsive on older phones.
function push(heap, item) {
  heap.push(item); let i = heap.length - 1;
  while (i) { const p = (i - 1) >> 1; if (heap[p].cost <= item.cost) break; heap[i] = heap[p]; i = p; }
  heap[i] = item;
}
function pop(heap) {
  const first = heap[0], last = heap.pop();
  if (heap.length) {
    let i = 0;
    while (i * 2 + 1 < heap.length) {
      let child = i * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
      if (heap[child].cost >= last.cost) break;
      heap[i] = heap[child]; i = child;
    }
    heap[i] = last;
  }
  return first;
}
function followRoad(route, start, end, maxLength) {
  if (start.edge === end.edge) return Math.abs(start.at - end.at) <= maxLength ? slice(start.edge, start.at, end.at) : null;
  const costs = new Map(), previous = new Map(), heap = [];
  for (const [id, cost] of [[start.edge.u, start.at], [start.edge.v, start.edge.length - start.at]]) {
    if (cost < (costs.get(id) ?? Infinity)) { costs.set(id, cost); push(heap, {id, cost}); previous.set(id, null); }
  }
  let best = null, bestCost = maxLength;
  const tails = new Map([[end.edge.u, end.at], [end.edge.v, end.edge.length - end.at]]);
  while (heap.length) {
    const {id, cost} = pop(heap);
    if (cost !== costs.get(id) || cost > bestCost) continue;
    if (tails.has(id) && cost + tails.get(id) <= bestCost) { best = id; bestCost = cost + tails.get(id); }
    for (const link of route.nodes.get(id) || []) {
      const next = cost + link.edge.length;
      if (next < bestCost && next < (costs.get(link.to) ?? Infinity)) {
        costs.set(link.to, next); previous.set(link.to, {id, link}); push(heap, {id: link.to, cost: next});
      }
    }
  }
  if (best === null) return null;
  const steps = []; let root = best;
  while (previous.get(root)) { const step = previous.get(root); steps.push(step.link); root = step.id; }
  const result = slice(start.edge, start.at, root === start.edge.u ? 0 : start.edge.length);
  for (const link of steps.reverse()) result.push(...(link.reverse ? [...link.edge.points].reverse() : link.edge.points).slice(1));
  result.push(...slice(end.edge, best === end.edge.u ? 0 : end.edge.length, end.at).slice(1));
  return result;
}
export function matchTrafficGeometry(index, road, geometry, project) {
  if (!geometry) return null;
  // Do not fabricate a stretch or a jam length from a location-only report.
  if (geometry.type === 'Point') {
    const point = project(geometry.coordinates);
    return point ? {type: 'Point', coordinates: point, locationOnly: true} : null;
  }
  if (geometry.type !== 'MultiLineString' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length > 100) return null;
  const route = index.get(road), result = [];
  let fallback = null;
  for (const line of geometry.coordinates) {
    if (!Array.isArray(line) || line.length < 2 || line.length > 2000) continue;
    const points = line.map(project);
    if (points.some(p => !p)) continue;
    fallback ||= points[0];
    if (!route) continue;
    // 150 m is a strict maximum, never snap to another numbered road.
    const lat = line[0][1], metresPerUnit = 111320 * Math.cos(lat * Math.PI / 180) / 175;
    const matches = points.map(p => nearest(route, p, 150 / metresPerUnit));
    if (matches.some(p => !p)) continue;
    const traced = []; let complete = true;
    for (let i = 1; i < matches.length; i++) {
      const straight = distance(matches[i - 1].point, matches[i].point);
      const path = followRoad(route, matches[i - 1], matches[i], Math.max(straight * 1.8, straight + 300 / metresPerUnit));
      if (!path) { complete = false; break; }
      traced.push(...(traced.length ? path.slice(1) : path));
    }
    if (complete && traced.length >= 2) result.push(traced);
  }
  // If any source part cannot be verified, show a location marker, not a partial red road.
  if (result.length && result.length === geometry.coordinates.length) return {type: 'MultiLineString', coordinates: result, locationOnly: false};
  return fallback ? {type: 'Point', coordinates: fallback, locationOnly: true} : null;
}
