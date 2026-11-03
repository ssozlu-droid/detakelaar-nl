# Geographic background source

`netherlands.geojson` is a compact geographic extract from Natural Earth, public
 domain, at 1:10 million scale. This is a generalized overview, not a current
navigation map. No invented coastlines or road alignments are used.

Upstream: https://github.com/nvkelso/natural-earth-vector
Revision: ca96624a56bd078437bca8184e78163e5039ad19
Files under `geojson/`:

- `ne_10m_admin_0_countries.geojson`: European Netherlands polygons, including
  Zeeland and the Wadden Islands; Caribbean polygons excluded.
- `ne_10m_lakes.geojson`: lakes intersecting the Netherlands extent.
- `ne_10m_roads.geojson`: road features intersecting longitude 3.2–7.25,
  latitude 50.7–53.6. The SVG clips these to the national land boundary.

Only geometry and the layer, road class, route and name attributes are retained.
Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/

Regenerate with `python3 tools/build-map.py` (Python standard library only).
The Mercator projection preserves local shape. A4/A12 highlights use the source
route attributes; badges anchor to vertices of those routes. Secondary roads
use a quiet stroke. City markers use geographic coordinates.

For TransIP, upload `assets/netherlands-roads.svg` and `styles.css` to the same
paths beneath `/www`. Development tools and this source extract do not need to
be uploaded. Leave the existing `.htaccess` intact. No API, external tiles,
cookies, build step or additional runtime dependency is required.
