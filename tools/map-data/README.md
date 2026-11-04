# Dutch geographic background and traffic matching

The gold roads and red traffic now share **one SVG, one projection and the same
road vertices**. The CSS background is only a static fallback if JavaScript or the
SVG download fails. No road or congestion geometry is hand-drawn.

## Numbered road network (new)

`roads.geojson.gz` contains 576 numbered Dutch A/N routes, represented by 41,157
links. It is a machine-readable ODbL derivative database of OpenStreetMap data.
The checked-in extract is freely available alongside the website source.

Upstream: https://github.com/fbkarsdorp/nl-road-map
Pinned revision: `0b9147a7d4151696937665c7ad4990851f7e6c4f` (2026-11-03).
Input files:

- `data/car.txt` SHA256 `e76580ff79b31042decae90f2896460ad7ba97aaa33f0eb15b894547570c4db4`
- `data/nl.txt` SHA256 `bff196253e1535c30d0669a3d4cf90812579ac3e921c4444571738ddbd2c502c`

The upstream graph preserves road geometry with 6 m simplification and 5 m
coordinate quantization. It retains the largest connected car network, contracts
chains of junctions, and assigns the dominant road name/reference to each chain.
This is suitable for a national overview; it is **not** a survey of every lane,
every ramp, every isolated road or every current road change. We retain only
numbered A/N links and explicitly exclude ferries and unnamed ferry tie-ins.
No routing weights, upstream application code, or artificial connector geometry
are reused. Geographic coordinates are recovered by inverting the documented
upstream local projection. SVG coordinates are rounded to 0.001 map units.

Data attribution and license: © OpenStreetMap contributors,
https://www.openstreetmap.org/copyright and
https://opendatacommons.org/licenses/odbl/1-0/ . The website displays attribution
beside the traffic legend. Keep it when republishing the map or database.

Reproduce the extract (Python standard library only):

```sh
git clone https://github.com/fbkarsdorp/nl-road-map.git /tmp/nl-road-map
git -C /tmp/nl-road-map checkout 0b9147a7d4151696937665c7ad4990851f7e6c4f
python3 tools/import-osm-roads.py /tmp/nl-road-map
python3 tools/build-map.py
```

## Coast and water (retained)

`netherlands.geojson` is a Natural Earth public-domain geographic extract at
1:10 million scale. Only its land and lake layers are used now; the old generalized
roads are not used. The coastline remains an overview, not a cadastral boundary.

Upstream: https://github.com/nvkelso/natural-earth-vector
Revision: `ca96624a56bd078437bca8184e78163e5039ad19`
Files: `geojson/ne_10m_admin_0_countries.geojson`, `ne_10m_lakes.geojson`.
European Netherlands only, including Zeeland and Wadden Islands.
Terms: https://www.naturalearthdata.com/about/terms-of-use/

## Traffic integrity

`traffic-map.js` builds its index directly from the paths in the downloaded SVG.
There is no second geometry file that can fall out of sync. Matching:

- Uses only the road number reported by NDW, never a nearby differently numbered road.
- Allows at most 150 metres between a reported point and its matching road.
- Follows connected road vertices between source points, with bounded detours.
- Does not bridge missing links, extrapolate jam ends, invent jam lengths, or
  turn an entire motorway red from a point report.
- Falls back to a clearly labelled location marker when a full supplied trajectory
  cannot be verified. The marker remains at the **reported** location.
- Preserves existing five-minute source freshness checks and removes expired reports.

The connected road graph is used for display, not driving directions. Directional
carriageway ambiguity and source location quality remain limits of the data.
Tests with simulated NDW data verify rendering/matching, not upstream live accuracy.

## TransIP upload

Upload these four changed runtime files to their existing locations under `/www`:

- `index.html`
- `styles.css`
- `live-updates.js`
- `assets/netherlands-roads.svg`

Also upload the **new** runtime module `traffic-map.js` directly under `/www`.
No API changes, extra API keys, cookies, external map tiles or hosting build are
needed. Keep the existing `.htaccess`. Development tools/tests/source extracts do
not need to be uploaded. GitHub pushes do not deploy to TransIP.
