"""Extract numbered Dutch roads from the pinned OSM-derived routing graph.
Usage: python3 tools/import-osm-roads.py /path/to/nl-road-map
See tools/map-data/README.md for upstream revision, license and limitations.
No upstream program code is copied or executed.
"""
import base64
import gzip
import hashlib
import json
import math
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
expected = {
    'car.txt': 'e76580ff79b31042decae90f2896460ad7ba97aaa33f0eb15b894547570c4db4',
    'nl.txt': 'bff196253e1535c30d0669a3d4cf90812579ac3e921c4444571738ddbd2c502c',
}
for filename, checksum in expected.items():
    if hashlib.sha256((source / 'data' / filename).read_bytes()).hexdigest() != checksum:
        raise ValueError(f'{filename} does not match the documented source revision')
raw = gzip.decompress(base64.b64decode((source / 'data/car.txt').read_bytes()))
size = struct.unpack_from('<I', raw)[0]
header = json.loads(raw[4:4 + size])
base = (4 + size + 7) // 8 * 8
formats = {'uint16': 'H', 'uint32': 'I', 'uint8': 'B', 'float32': 'f'}
arrays = {a['name']: struct.unpack_from('<' + str(a['length']) + formats[a['type']], raw, base + a['offset']) for a in header['arrays']}
land = json.loads(gzip.decompress(base64.b64decode((source / 'data/nl.txt').read_bytes())))

def geographic(x, y):
    north = land['Y0'] + y * header['Q']
    east = land['X0'] + x * header['Q']
    lat = land['LAT0'] + north / 110950
    lon = land['LON0'] + east / (111320 * math.cos(math.radians(lat)))
    return [round(lon, 6), round(lat, 6)]

routes = {}
for i, name_id in enumerate(arrays['ln']):
    name = header['names'][name_id].replace(' ', '')
    # Exclude ferries, invented ferry tie-ins and unnamed links entirely.
    if not re.fullmatch(r'[AN]\d{1,3}', name) or arrays['lf'][i] & 2:
        continue
    u, v = arrays['lu'][i], arrays['lv'][i]
    coords = [geographic(arrays['jx'][u], arrays['jy'][u])]
    coords += [geographic(arrays['gx'][j], arrays['gy'][j]) for j in range(arrays['gptr'][i], arrays['gptr'][i + 1])]
    coords += [geographic(arrays['jx'][v], arrays['jy'][v])]
    coords = [p for j, p in enumerate(coords) if j == 0 or p != coords[j - 1]]
    if len(coords) >= 2:
        routes.setdefault(name, []).append(coords)
collection = {'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'route': route}, 'geometry': {'type': 'MultiLineString', 'coordinates': lines}}
    for route, lines in sorted(routes.items())]}
output = json.dumps(collection, separators=(',', ':')).encode()
(ROOT / 'tools/map-data/roads.geojson.gz').write_bytes(gzip.compress(output, mtime=0))
print(f'{len(routes)} numbered A/N routes, {sum(map(len, routes.values()))} links')
print('Upstream car.txt SHA256:', hashlib.sha256((source / 'data/car.txt').read_bytes()).hexdigest())
print('Upstream nl.txt SHA256:', hashlib.sha256((source / 'data/nl.txt').read_bytes()).hexdigest())
