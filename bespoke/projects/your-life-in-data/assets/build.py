# /// script
# requires-python = ">=3.10"
# dependencies = ["PyMySQL", "requests"]
# ///
"""
Your Life in Data — Stage A+B build.

Extracts OWID's curated Featured Metrics from the local `grapher` MySQL, rolls the
fine FM topics up to OWID's 10 canonical top-level topic areas via `tag_graph`,
fetches+caches each chart's data, filters to indicators usable for a "since you were
born" card, and emits `../data/catalog.json` grouped by area and ordered by FM rank.

No AI here (Phase 1). Run:  uv run assets/build.py
Re-runs reuse assets/cache/ so they're fast.
"""
import concurrent.futures as cf
import csv
import io
import json
import os
import re
import sys
from pathlib import Path

import pymysql
import requests

HERE = Path(__file__).resolve().parent
APP = HERE.parent
CACHE = HERE / "cache"
CACHE.mkdir(exist_ok=True)
OUT = APP / "data" / "catalog.json"
OUT.parent.mkdir(exist_ok=True)
# countries.json is imported directly by the React app, so it's written straight into
# src/data/ — the single canonical copy, not a build output to be manually re-copied in.
SRC_DATA = APP / "src" / "data"

DB = dict(
    host=os.environ.get("GRAPHER_DB_HOST", "127.0.0.1"),
    port=int(os.environ.get("GRAPHER_DB_PORT", "3306")),
    user=os.environ.get("GRAPHER_DB_USER", "grapher"),
    password=os.environ.get("GRAPHER_DB_PASS", "grapher"),
    database=os.environ.get("GRAPHER_DB_NAME", "grapher"),
)

# OWID's 10 canonical top-level topic areas (children of tag-graph-root).
# id -> friendly subtopic label shown in the card.
AREAS = {
    1501: "Health",
    1504: "Environment",                  # "Energy and Environment"
    1834: "Economy",                       # "Poverty and Economic Development"
    1502: "Food & Agriculture",
    1835: "Living Conditions",             # "Living Conditions, Community and Wellbeing"
    1512: "Rights & Democracy",            # "Human Rights and Democracy"
    1510: "Violence & War",
    1500: "Population & Demography",                    # "Population and Demographic Change"
    1505: "Technology",                    # "Innovation and Technological Change"
    1513: "Education",                     # "Education and Knowledge"
}

# Good/bad direction is decided by the AI curator (assets/ai_curate.py), not here —
# a keyword heuristic was too crude and is no longer used.

GRAPHER = "https://ourworldindata.org/grapher/{slug}.csv?csvType=full&useColumnShortNames=true"
FILTERED = ("https://ourworldindata.org/grapher/{slug}.csv"
            "?csvType=filtered&useColumnShortNames=true&country=~{codes}")
META = "https://ourworldindata.org/grapher/{slug}.metadata.json"
ISO3 = re.compile(r"^[A-Z]{3}$")

# The curated global set is editorial DATA, not code — it lives in
# assets/curated.config.json (edit it, then re-run this script). Loaded below.
WORLD = "OWID_WRL"


def fetch_rows():
    """All default-income FM grapher charts, with their FM topic + rank, rolled up to
    a top-level area. One chart can map to several areas (kept in each)."""
    conn = pymysql.connect(**DB, cursorclass=pymysql.cursors.DictCursor)
    sql = """
    WITH RECURSIVE up AS (
        SELECT g.childId AS orig, g.parentId FROM tag_graph g
        UNION ALL
        SELECT u.orig, g.parentId FROM up u JOIN tag_graph g ON g.childId = u.parentId
    )
    SELECT fm.url, fm.ranking, up.parentId AS areaId
    FROM featured_metrics fm
    JOIN up ON up.orig = fm.parentTagId
    WHERE fm.incomeGroup = 'default'
      AND fm.url LIKE '%%/grapher/%%'
      AND up.parentId IN (%s)
    """ % ",".join(str(i) for i in AREAS)
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()
    conn.close()
    return rows


def slug_of(url):
    m = re.search(r"/grapher/([^/?#]+)", url)
    return m.group(1) if m else None


def cached(slug, suffix, url):
    p = CACHE / f"{slug}.{suffix}"
    if p.exists() and p.stat().st_size > 0:
        return p.read_text()
    try:
        r = requests.get(url, timeout=40)
        if r.status_code != 200 or not r.text.strip():
            p.write_text("")
            return None
        p.write_text(r.text)
        return r.text
    except requests.RequestException:
        return None


def analyse(slug):
    """Fetch CSV+metadata, decide suitability, derive label/unit/format/direction."""
    meta_txt = cached(slug, "metadata.json", META.format(slug=slug))
    csv_txt = cached(slug, "csv", GRAPHER.format(slug=slug))
    if not csv_txt:
        return slug, None, "no-csv"
    reader = csv.reader(io.StringIO(csv_txt))
    header = next(reader, None)
    if not header or len(header) < 4:
        return slug, None, "no-value-column"
    # columns (useColumnShortNames=true): entity, code, year, <value...> (lowercase)
    lower = [h.strip().lower() for h in header]
    try:
        ci_code = lower.index("code")
        ci_year = lower.index("year")
    except ValueError:
        return slug, None, "no-code/year"
    skip = {"entity", "code", "year"}
    value_cols = [i for i in range(len(header)) if lower[i] not in skip]
    if not value_cols:
        return slug, None, "no-value-column"
    vi = value_cols[0]
    countries, years = set(), set()
    for row in reader:
        if len(row) <= max(vi, ci_code, ci_year):
            continue
        code, yr, val = row[ci_code], row[ci_year], row[vi]
        if not val.strip():
            continue
        if ISO3.match(code) and not code.startswith("OWID_"):
            countries.add(code)
            try:
                years.add(int(yr))
            except ValueError:
                pass
    if len(countries) < 30:
        return slug, None, f"too-few-countries({len(countries)})"
    if not years:
        return slug, None, "no-country-years"
    ymin, ymax = min(years), max(years)
    if ymax < 2015 or ymin > 2010 or (ymax - ymin) < 15:
        return slug, None, f"span({ymin}-{ymax})"

    meta = {}
    if meta_txt:
        try:
            meta = json.loads(meta_txt)
        except json.JSONDecodeError:
            meta = {}
    # metadata "columns" are keyed by the LONG title, while the CSV uses short names —
    # match by shortName/title, else fall back to the single column.
    cols = (meta.get("columns") or {})
    col_meta = {}
    if isinstance(cols, dict) and cols:
        for v in cols.values():
            if v.get("shortName") == header[vi]:
                col_meta = v
                break
        if not col_meta:
            col_meta = next(iter(cols.values()))
    label = (meta.get("chart", {}).get("title")
             or col_meta.get("titleShort") or col_meta.get("name") or slug)
    unit = (col_meta.get("shortUnit") or col_meta.get("unit") or "").strip()
    fmt = derive_format(unit, label)
    # OWID metadata is a feature, not an afterthought — carry a short description,
    # the full unit, and the source so the card can let people explore.
    desc = (col_meta.get("descriptionShort")
            or (col_meta.get("descriptionKey") or [""])[0]
            or col_meta.get("descriptionFromProducer") or "").strip()
    source = (col_meta.get("citationShort") or col_meta.get("attribution")
              or col_meta.get("attributionShort") or col_meta.get("sourceName")
              or meta.get("attribution") or "").strip()
    full_unit = (col_meta.get("unit") or unit or "").strip()
    return slug, dict(
        slug=slug, valueColumn=header[vi], label=label, unit=unit, fullUnit=full_unit,
        format=fmt, comparable=is_comparable(fmt, full_unit, label, slug),
        desc=desc[:400], source=source[:160],
        yearStart=ymin, yearEnd=ymax, nCountries=len(countries),
    ), "ok"


def is_comparable(fmt, unit, label, slug):
    """True when the metric is normalized (rate/share/per-capita/index) so a country
    value can be sensibly shown against the World value. Absolute totals (counts,
    total tonnes) are NOT comparable — World dwarfs any country."""
    if fmt in ("pct", "index", "years"):
        return True
    text = f"{unit} {label} {slug}".lower()
    if re.search(r"per[ -](capita|person|inhabitant|head)|per[ -]?\d|per million|per hectare|"
                 r"\brate\b|%|share|average|index|expectancy", text):
        return True
    return False  # plain count / total → not comparable to World


def derive_format(unit, label):
    u = unit.lower()
    if u in ("%",) or "percent" in u or "%" in label:
        return "pct"
    if u in ("$", "int-$", "us$") or "$" in unit:
        return "usd"
    if "year" in u:
        return "years"
    if u in ("kg", "kilograms") or "kilogram" in u:
        return "kg"
    if "tonne" in u or u == "t" or u.startswith("t/"):
        return "tonnes"
    return "number"


def write_countries(kept_slugs):
    """Extract a clean name<->ISO3 list from the broadest cached CSV among kept slugs."""
    best = {}
    for slug in kept_slugs:
        p = CACHE / f"{slug}.csv"
        if not p.exists() or p.stat().st_size == 0:
            continue
        reader = csv.reader(io.StringIO(p.read_text()))
        header = next(reader, None)
        if not header:
            continue
        lower = [h.strip().lower() for h in header]
        if "code" not in lower or "entity" not in lower:
            continue
        ci_e, ci_c = lower.index("entity"), lower.index("code")
        mapping = {}
        for row in reader:
            if len(row) <= max(ci_e, ci_c):
                continue
            code = row[ci_c]
            if ISO3.match(code) and not code.startswith("OWID_"):
                mapping[code] = row[ci_e]
        if len(mapping) > len(best):
            best = mapping
    # attach each country's OWID continent entity (for the "explore" chart link)
    cont_code = {"Africa": "OWID_AFR", "Asia": "OWID_ASI", "Europe": "OWID_EUR",
                 "North America": "OWID_NAM", "South America": "OWID_SAM", "Oceania": "OWID_OCE"}
    continent = {}
    txt = cached("continents-according-to-our-world-in-data", "csv",
                 GRAPHER.format(slug="continents-according-to-our-world-in-data"))
    if txt:
        r = csv.reader(io.StringIO(txt))
        h = [x.strip().lower() for x in next(r)]
        ci, vi = h.index("code"), len(h) - 1
        for row in r:
            if len(row) > max(ci, vi):
                continent[row[ci]] = cont_code.get(row[vi].strip())
    # each country's latest World Bank income group (for the comparison-entity picker)
    inc_code = {"Low-income countries": "OWID_LIC", "Lower-middle-income countries": "OWID_LMC",
                "Upper-middle-income countries": "OWID_UMC", "High-income countries": "OWID_HIC"}
    income, latest = {}, {}
    txt = cached("world-bank-income-groups", "csv", GRAPHER.format(slug="world-bank-income-groups"))
    if txt:
        r = csv.reader(io.StringIO(txt))
        h = [x.strip().lower() for x in next(r)]
        ci, yi, vi = h.index("code"), h.index("year"), len(h) - 1
        for row in r:
            if len(row) <= max(ci, yi, vi):
                continue
            try:
                y = int(row[yi])
            except ValueError:
                continue
            if row[ci] not in latest or y > latest[row[ci]]:
                latest[row[ci]] = y
                income[row[ci]] = inc_code.get(row[vi].strip())

    countries = [{"code": c, "name": n, "continent": continent.get(c), "income": income.get(c)}
                 for c, n in sorted(best.items(), key=lambda kv: kv[1])]
    (SRC_DATA / "countries.json").write_text(json.dumps(countries, indent=0))
    print(f"  countries.json: {len(countries)} countries, "
          f"{sum(1 for c in countries if c['continent'])} continent, "
          f"{sum(1 for c in countries if c['income'])} income", file=sys.stderr)


def fetch_filtered(slug, codes):
    """Filtered CSV for specific entities (cached). csvType=filtered respects country=."""
    tag = "-".join(codes)
    p = CACHE / f"{slug}.{tag}.csv"
    if p.exists() and p.stat().st_size:
        return p.read_text()
    url = FILTERED.format(slug=slug, codes="~".join(codes))
    try:
        r = requests.get(url, timeout=40)
        txt = r.text if r.status_code == 200 else ""
    except requests.RequestException:
        txt = ""
    p.write_text(txt or "")
    return txt


def parse_series(txt, value_col):
    """{code: [[year,val]...]} for all entities in a filtered CSV."""
    out = {}
    if not txt:
        return out
    reader = csv.reader(io.StringIO(txt))
    header = next(reader, None)
    if not header:
        return out
    lower = [h.strip().lower() for h in header]
    if "code" not in lower or "year" not in lower:
        return out
    ci, yi = lower.index("code"), lower.index("year")
    vi = lower.index(value_col.lower()) if value_col.lower() in lower else next(
        (i for i in range(len(lower)) if lower[i] not in ("entity", "code", "year")), -1)
    if vi < 0:
        return out
    for row in reader:
        if len(row) <= max(ci, yi, vi):
            continue
        try:
            y, v = int(row[yi]), float(row[vi])
        except ValueError:
            continue
        out.setdefault(row[ci], []).append([y, v])
    for s in out.values():
        s.sort()
    return out


def write_curated(info):
    """Emit data/curated.json from assets/curated.config.json: the hand-picked global
    set + pre-baked series for the showcase countries (+ World), with metadata
    (desc/unit/source) for tooltips."""
    cfg = json.loads((HERE / "curated.config.json").read_text())
    prebake = cfg.get("prebakeCountries", [])
    keep = set(prebake) | {WORLD}
    metrics, data = [], {}
    for spec in cfg["metrics"]:
        slug = spec["slug"]
        base = info.get(slug, {})
        vcol = base.get("valueColumn", "")
        if not vcol:
            print(f"  curated WARN: {slug} not in kept catalog (skipped)", file=sys.stderr)
            continue
        metrics.append(dict(
            slug=slug, valueColumn=vcol, label=spec["label"], subtopic=spec["subtopic"],
            format=spec["format"], goodDirection=spec["goodDirection"],
            comparable=base.get("comparable", True),
            unit=base.get("fullUnit", ""), desc=base.get("desc", ""), source=base.get("source", ""),
        ))
        # use the already-cached FULL csv (multi-country filter is unreliable), keep the
        # showcase countries + World, trim to 1900+ (the birth-year input floor)
        full = cached(slug, "csv", GRAPHER.format(slug=slug))
        for code, s in parse_series(full, vcol).items():
            if code in keep:
                data.setdefault(code, {})[slug] = [p for p in s if p[0] >= 1900]
    (APP / "data" / "curated.json").write_text(json.dumps(
        {"countries": prebake, "world": WORLD, "metrics": metrics, "data": data}, indent=0))
    print(f"  curated.json: {len(metrics)} metrics, pre-baked {prebake}+World", file=sys.stderr)


def main():
    print("Querying featured_metrics + tag_graph rollup…", file=sys.stderr)
    rows = fetch_rows()
    # best (lowest) FM rank per (slug, area)
    by_slug_area = {}  # (slug, areaId) -> best rank
    for r in rows:
        slug = slug_of(r["url"])
        if not slug:
            continue
        key = (slug, r["areaId"])
        by_slug_area[key] = min(r["ranking"], by_slug_area.get(key, 10**9))
    slugs = sorted({s for s, _ in by_slug_area})
    print(f"{len(rows)} FM rows → {len(slugs)} distinct grapher slugs", file=sys.stderr)

    print(f"Fetching + analysing {len(slugs)} charts (cached in {CACHE.name}/)…", file=sys.stderr)
    info, drops = {}, {}
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for slug, data, reason in ex.map(analyse, slugs):
            if data:
                info[slug] = data
            else:
                drops[slug] = reason

    # group into areas, preserving FM rank order
    catalog = {label: [] for label in AREAS.values()}
    for (slug, areaId), rank in by_slug_area.items():
        if slug not in info:
            continue
        entry = dict(info[slug], fmRank=rank, fmArea=AREAS[areaId])
        catalog[AREAS[areaId]].append(entry)
    for label in catalog:
        catalog[label].sort(key=lambda e: (e["fmRank"], e["label"]))

    OUT.write_text(json.dumps(
        {"generated": "stage-A+B, no AI curation", "areas": catalog}, indent=2))

    # countries.json (name<->code) from the broadest cached CSV, for the dropdown
    write_countries(set(info))
    # curated.json (editorial global set + pre-baked showcase data)
    write_curated(info)

    kept = len(info)
    print(f"\n✓ kept {kept} indicators, dropped {len(drops)}", file=sys.stderr)
    print("  per subtopic:", file=sys.stderr)
    for label, items in sorted(catalog.items(), key=lambda kv: -len(kv[1])):
        print(f"    {label:18} {len(items)}", file=sys.stderr)
    # drop reasons summary (no silent truncation)
    reasons = {}
    for reason in drops.values():
        key = re.sub(r"\(.*\)", "", reason)
        reasons[key] = reasons.get(key, 0) + 1
    print("  drop reasons:", dict(sorted(reasons.items(), key=lambda kv: -kv[1])), file=sys.stderr)
    print(f"  → {OUT.relative_to(APP)}", file=sys.stderr)


if __name__ == "__main__":
    main()
