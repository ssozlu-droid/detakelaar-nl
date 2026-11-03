"""Build the static background from the checked-in Natural Earth geographic extract.
Run from any directory: python3 tools/build-map.py. No third-party dependencies.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
features = json.loads((ROOT / 'tools/map-data/netherlands.geojson').read_text())['features']

def project(point):
    lon, lat = point
    merc = lambda deg: math.degrees(math.log(math.tan(math.pi / 4 + math.radians(deg) / 2)))
    return 540 + (lon - 3.2) * 175, 65 + (merc(53.65) - merc(lat)) * 175

def line(coords, close=False):
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in map(project, coords)) + ('Z' if close else '')

def path(geometry):
    coords = geometry['coordinates']
    kind = geometry['type']
    if kind == 'LineString': return line(coords)
    if kind == 'MultiLineString': return ''.join(line(c) for c in coords)
    if kind == 'Polygon': return ''.join(line(c, True) for c in coords)
    if kind == 'MultiPolygon': return ''.join(line(r, True) for p in coords for r in p)
    raise ValueError(kind)

land = path(features[0]['geometry'])
roads = [f for f in features if f['properties']['layer'] == 'roads']
major = [f for f in roads if f['properties']['type'] == 'Major Highway']
minor = [f for f in roads if f not in major]
highlight = [f for f in major if f['properties']['route'] in ('A4', 'A12')]
paths = lambda fs: ''.join(f'<path d="{path(f["geometry"])}"/>' for f in fs)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1100" viewBox="0 0 1440 1100" fill="none">
<title>Nederland — kust, eilanden en snelwegen in zwart en goud</title>
<desc>Geografische gegevens: Natural Earth 1:10m, publiek domein. Mercatorprojectie. Gegeneraliseerde overzichtskaart, niet voor navigatie.</desc>
<defs>
<radialGradient id="land"><stop stop-color="#26251b"/><stop offset="1" stop-color="#151916"/></radialGradient>
<linearGradient id="gold" x1="600" y1="900" x2="1200" y2="150" gradientUnits="userSpaceOnUse"><stop stop-color="#8c6936"/><stop offset=".5" stop-color="#e2c17c"/><stop offset="1" stop-color="#a78348"/></linearGradient>
<clipPath id="nl"><path d="{land}" fill-rule="evenodd"/></clipPath>
<g id="highways">{paths(major)}</g>
</defs>
<path d="{land}" fill="url(#land)" fill-rule="evenodd" stroke="#a88c54" stroke-opacity=".32" stroke-width="1.1"/>
<g clip-path="url(#nl)">
<g fill="#101313" stroke="#a88c54" stroke-opacity=".18" stroke-width=".7">{paths([f for f in features if f['properties']['layer'] == 'lakes'])}</g>
<g stroke="#b39359" stroke-opacity=".14" stroke-width=".65" stroke-linejoin="round">{paths(minor)}</g>
<g stroke-linejoin="round" stroke-linecap="round">
<use href="#highways" stroke="#cda75f" stroke-width="5" opacity=".08"/>
<use href="#highways" stroke="#493e27" stroke-width="2.7"/>
<use href="#highways" stroke="url(#gold)" stroke-width="1.15" opacity=".78"/>
<g stroke="#e6c886" stroke-width="1.9">{paths(highlight)}</g>
</g></g>
'''
# Attach shields to actual route vertices, never to hand-drawn road alignments.
for route, target in [('A4', (4.56, 52.18)), ('A12', (4.8, 52.04)), ('A12', (5.85, 52.04))]:
    vertices = [p for f in highlight if f['properties']['route'] == route for p in f['geometry']['coordinates']]
    point = min(vertices, key=lambda p: (p[0]-target[0])**2 + (p[1]-target[1])**2)
    x,y = project(point)
    svg += f'<g transform="translate({x-20:.1f} {y-29:.1f})"><path d="M20 24v5" stroke="#b99859"/><rect width="40" height="24" rx="5" fill="#1b1e18" stroke="#ad8c4f" stroke-opacity=".7"/><text x="20" y="16" fill="#e8ce95" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" text-anchor="middle">{route}</text></g>\n'
for name, lon, lat, dx, dy in [('AMSTERDAM',4.895,52.37,10,-10),('DEN HAAG',4.30,52.08,-88,-8),('ROTTERDAM',4.48,51.92,-95,18),('GOUDA',4.71,52.01,9,19),('RIJSWIJK',4.33,52.04,-74,12),('UTRECHT',5.12,52.09,10,16),('ARNHEM',5.91,51.98,10,16),('GRONINGEN',6.57,53.22,10,-10),('EINDHOVEN',5.48,51.44,10,16)]:
    x,y = project((lon,lat))
    svg += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="#d9b978" stroke="#171b16" stroke-width="2"/><text x="{x+dx:.1f}" y="{y+dy:.1f}" font-family="Arial,Helvetica,sans-serif" font-size="9" letter-spacing="1.4" fill="#b9ac8b" opacity=".7">{name}</text>\n'
svg += '</svg>\n'
(ROOT / 'assets/netherlands-roads.svg').write_text(svg)
print('Generated assets/netherlands-roads.svg')
