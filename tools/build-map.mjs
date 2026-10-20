// Rebuilds src/mapGrid.json from the atlas's grid (data/mapGrid.atlas.json).
//
// The atlas grid crops its two enlarged insets at column 0: Central America loses Guatemala, El Salvador and the west
// of Honduras, the Levant the coast of Lebanon and most of Israel. This script fits each inset to Natural Earth
// borders (scale and offset found on the cells still visible), redraws the whole inset, widens the grid on the left
// so nothing is cropped, and recomputes the label anchors of the countries involved with the atlas's own rule.
//
// Usage (from the project root):
//   node tools/build-map.mjs          writes src/mapGrid.json
//   node tools/build-map.mjs --check  rebuilds in memory and fails if src/mapGrid.json differs
// The Natural Earth borders (world-atlas 2.0.2, 1:10m, about 3.6 MB) are downloaded once into tools/.cache.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ATLAS = `${root}data/mapGrid.atlas.json`
const OUT = `${root}src/mapGrid.json`
const CACHE = `${root}tools/.cache`
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json'
const check = process.argv.includes('--check')

// ------------------------------------------------------------------ the atlas grid

const G = JSON.parse(readFileSync(ATLAS, 'utf8'))
const C = G.cols, R = G.rows
const decode = (rle, n) => { const g = new Int16Array(n); for (let i = 0, s = 0; i < rle.length; i += 2) { g.fill(rle[i], s, s + rle[i + 1]); s += rle[i + 1] } return g }
/** The atlas as shipped: the fits compare against it. */
const atlas = decode(G.rle, C * R)

/** 4-connected areas of each country, largest first. */
function components(grid, C, R) {
  const seen = new Uint8Array(C * R), out = {}
  for (let s = 0; s < C * R; s++) {
    const k = grid[s]
    if (k < 0 || seen[s]) continue
    const cells = [], st = [s]
    seen[s] = 1
    while (st.length) {
      const t = st.pop(), x = t % C, y = (t / C) | 0
      cells.push(t)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue
        const u = ny * C + nx
        if (!seen[u] && grid[u] === k) { seen[u] = 1; st.push(u) }
      }
    }
    ;(out[k] ??= []).push(cells)
  }
  for (const k in out) out[k].sort((a, b) => b.length - a.length)
  return out
}

/** The atlas's anchor rule: the cell of the country's largest area nearest that area's centroid. */
function anchorOf(cells, C) {
  const cx = cells.reduce((s, t) => s + (t % C), 0) / cells.length, cy = cells.reduce((s, t) => s + ((t / C) | 0), 0) / cells.length
  let b = cells[0], bd = Infinity
  for (const t of cells) { const d = (t % C - cx) ** 2 + (((t / C) | 0) - cy) ** 2; if (d < bd) { bd = d; b = t } }
  return [b % C, (b / C) | 0, cells.length]
}

// The rule must give back every anchor of the atlas before it is trusted with new ones.
{
  const comps = components(atlas, C, R)
  const bad = Object.entries(G.anchor).filter(([k, a]) => { const b = anchorOf(comps[k][0], C); return b[0] !== a[0] || b[1] !== a[1] || b[2] !== a[2] })
  if (bad.length) throw new Error(`anchor rule disagrees with the atlas for ${bad.map(([k]) => k).join(', ')}`)
}

// ------------------------------------------------------------------ Natural Earth borders (TopoJSON)

async function loadTopo() {
  const file = `${CACHE}/countries-10m.json`
  if (!existsSync(file)) {
    console.log(`downloading ${TOPO_URL}`)
    const res = await fetch(TOPO_URL)
    if (!res.ok) throw new Error(`download failed: ${res.status}`)
    mkdirSync(CACHE, { recursive: true })
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}
const topo = await loadTopo()
const [ksx, ksy] = topo.transform.scale, [ktx, kty] = topo.transform.translate
const arcs = topo.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => [(x += dx) * ksx + ktx, (y += dy) * ksy + kty]) })
const ring = (r) => r.flatMap((i, k) => { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; return k ? a.slice(1) : a })
const bboxOf = (rings) => { const pts = rings.flat(); return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))] }
/** A country's outline by ISO 3166 numeric code. */
function shape(iso) {
  const g = topo.objects.countries.geometries.find((o) => o.id === iso)
  const polys = (g.type === 'Polygon' ? [g.arcs] : g.arcs).map((p) => p.map(ring))
  return { polys, rings: polys.flat(), bbox: bboxOf(polys.flat()) }
}
const fromPolys = (polys) => ({ polys, rings: polys.flat(), bbox: bboxOf(polys.flat()) })
function inside(sh, lon, lat) {
  const b = sh.bbox
  if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) return false
  let c = false
  for (const r of sh.rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// ------------------------------------------------------------------ fitting each inset

/** Cells of countries, with x = ox + lon·sx and y = oy − lat·sy, sampled at each cell centre over [x0,x1) × [y0,y1). */
function raster(shapes, p, [x0, y0, x1, y1]) {
  const out = {}
  for (const id of Object.keys(shapes)) out[id] = []
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const lon = (x + 0.5 - p.ox) / p.sx, lat = (p.oy - (y + 0.5)) / p.sy
    for (const [id, sh] of Object.entries(shapes)) if (inside(sh, lon, lat)) { out[id].push([x, y]); break }
  }
  return out
}

/**
 * The insets: game country → ISO code, the window where the atlas's inset lies (x ≥ 0 only, the rest is cropped),
 * and a starting guess for the transform read off a few borders.
 */
const INSETS = {
  centralAmerica: { countries: { 63: '320', 64: '222', 4: '340', 5: '558', 65: '188', 6: '591' }, win: [0, 78, 28, 106], init: { sx: 2.6, sy: 2.6, lon0: -83, x0: 12, lat0: 15, y0: 82 } },
  levant: { countries: { 79: '422', 51: '376', 78: '400' }, win: [0, 105, 36, 162], init: { sx: 8, sy: 8.1, lon0: 39.3, x0: 25, lat0: 33.37, y0: 123 } },
}

/** Scale and offset that best match the visible cells (cells right minus cells wrong), by coordinate descent. */
function fit(inset, shapes) {
  const [wx0, wy0, wx1, wy1] = inset.win, act = {}
  for (const id of Object.keys(shapes)) act[id] = new Set()
  for (let y = wy0; y < Math.min(wy1, R); y++) for (let x = wx0; x < wx1; x++) { const k = atlas[y * C + x]; if (act[k]) act[k].add(y * C + x) }
  const score = (p) => {
    const r = raster(shapes, p, inset.win)
    let hit = 0, miss = 0
    for (const id of Object.keys(shapes)) {
      const pred = new Set(r[id].map(([x, y]) => y * C + x))
      for (const s of pred) act[id].has(s) ? hit++ : miss++
      for (const s of act[id]) if (!pred.has(s)) miss++
    }
    return { hit, miss, v: hit - miss }
  }
  const i = inset.init
  let p = { sx: i.sx, sy: i.sy, ox: i.x0 - i.lon0 * i.sx, oy: i.y0 + i.lat0 * i.sy }
  let best = score(p)
  const steps = { sx: 0.4, sy: 0.4, ox: 4, oy: 4 }
  for (let round = 0; round < 40; round++) {
    let improved = false
    for (const k of ['sx', 'sy', 'ox', 'oy']) for (const d of [-1, 1]) {
      const q = { ...p, [k]: p[k] + d * steps[k] }
      // A change of scale keeps the starting point in place.
      if (k === 'sx') q.ox = p.ox - d * steps.sx * i.lon0
      if (k === 'sy') q.oy = p.oy + d * steps.sy * i.lat0
      const s = score(q)
      if (s.v > best.v) { best = s; p = q; improved = true }
    }
    if (!improved) { for (const k in steps) steps[k] /= 2; if (steps.ox < 0.05) break }
  }
  return { p, best }
}

// ------------------------------------------------------------------ redrawing

// The atlas gives the West Bank to Jordan (its claim until 1988); Gaza lies wholly in the cropped part and is left out.
const westBank = shape('275').polys.filter((poly) => poly[0].reduce((a, pt) => a + pt[0], 0) / poly[0].length > 34.9)
const plans = [
  { name: 'centralAmerica', override: {} },
  { name: 'levant', override: { 78: fromPolys([...shape('400').polys, ...westBank]) } },
]

const grid = atlas.slice()
const paint = [] // [x, y, id], x possibly negative
const touched = new Set()
for (const plan of plans) {
  const inset = INSETS[plan.name]
  const shapes = { ...Object.fromEntries(Object.entries(inset.countries).map(([id, iso]) => [id, shape(iso)])), ...plan.override }
  const ids = Object.keys(shapes).map(Number)
  ids.forEach((id) => touched.add(id))
  const { p, best } = fit(inset, shapes)
  // Clear the cropped inset of these countries, then draw it whole.
  const [cx0, cy0, cx1, cy1] = inset.win
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) if (ids.includes(grid[y * C + x])) grid[y * C + x] = -1
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const sh of Object.values(shapes)) {
    x0 = Math.min(x0, Math.floor(p.ox + sh.bbox[0] * p.sx) - 1); x1 = Math.max(x1, Math.ceil(p.ox + sh.bbox[2] * p.sx) + 1)
    y0 = Math.min(y0, Math.floor(p.oy - sh.bbox[3] * p.sy) - 1); y1 = Math.max(y1, Math.ceil(p.oy - sh.bbox[1] * p.sy) + 1)
  }
  const r = raster(shapes, p, [x0, Math.max(0, y0), x1, Math.min(R, y1)])
  for (const [id, cells] of Object.entries(r)) for (const [x, y] of cells) paint.push([x, y, +id])
  const fmt = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, +v.toFixed(3)]))
  console.log(`${plan.name}: ${best.hit} visible cells matched, ${best.miss} off; transform ${JSON.stringify(fmt)}`)
}

// Widen on the left: room for the insets, their two-cell halo and one cell of sea.
const K = -Math.min(0, ...paint.map(([x]) => x)) + 3, NC = C + K
const ng = new Int16Array(NC * R).fill(-1)
for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) ng[y * NC + x + K] = grid[y * C + x]
let clash = 0
for (const [x, y, id] of paint) { const s = y * NC + x + K; if (ng[s] >= 0 && ng[s] !== id) { clash++; continue } ng[s] = id }
if (clash) throw new Error(`${clash} inset cells would cover another country`)

// Anchors: moved with the grid, recomputed for the countries of the insets.
const comps = components(ng, NC, R)
const anchor = {}
for (const [k, a] of Object.entries(G.anchor)) {
  anchor[k] = touched.has(+k) ? anchorOf(comps[k][0].slice().sort((p, q) => p - q), NC) : [a[0] + K, a[1], a[2]]
}

// Run-length encoded as [value, length] pairs, like the atlas file.
const rle = []
for (let s = 0; s < ng.length;) { let e = s; while (e < ng.length && ng[e] === ng[s]) e++; rle.push(ng[s], e - s); s = e }
const json = JSON.stringify({ cols: NC, rows: R, rle, anchor })
console.log(`grid ${C} → ${NC} columns (${K} added on the left)`)

if (check) {
  const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === json
  console.log(same ? 'src/mapGrid.json is up to date' : 'src/mapGrid.json differs from the rebuild')
  process.exit(same ? 0 : 1)
}
writeFileSync(OUT, json)
console.log('wrote src/mapGrid.json')
