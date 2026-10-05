"""Build sample data files for the conflict-deaths treemap.

The production files will come from an ETL export step in owid/etl. Until that
step exists, this script builds files with the same shape from our public UCDP
indicators, so the chart can be developed and reviewed. It also serves as a
reference for the ETL step: the output format below is the contract.

Usage (standard library only, no installs needed):

    python3 scripts/build_sample_data.py           # build the files
    python3 scripts/build_sample_data.py --serve   # build them, then serve them

The files land in ./sample-data/<ETL step path>/. With --serve, they are
served at http://localhost:8100, so the dev server can read them:

    BESPOKE_DATA_URL=http://localhost:8100 yarn startBespokeDevServer

Output:

    conflict-deaths.metadata.json   regions, entities, conflict types, years,
                                    and the "methods and sources" metadata
    conflict-deaths.<typeId>.json   one file per conflict type, holding the
                                    non-zero deaths as parallel arrays
                                    {"values": [...], "entities": [...], "years": [...]}

Data notes:

- Deaths are UCDP's best estimates, counted in the country where the fighting
  happened (events are placed in countries using their coordinates).
- The public indicators include preliminary data for the current year. We keep
  only years up to LAST_YEAR, which come from UCDP's stable release.
- Countries are assigned to UCDP's five regions through their Gleditsch-Ward
  codes, the same rule the ETL uses (`add_region_from_code` in
  etl/steps/data/garden/war/<version>/shared.py).
"""

import functools
import http.server
import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

FIRST_YEAR = 1989
LAST_YEAR = 2025

# Where the files go: the ETL step path the bundle registry points to
SAMPLE_DATA_ROOT = Path(__file__).parent.parent / "sample-data"
ETL_STEP_PATH = "war/latest/ucdp_conflict_deaths_treemap"
PORT = 8100

API = "https://api.ourworldindata.org/v1/indicators"

# Conflict types in the order they appear in the dropdown. Each points to the
# public indicator "Deaths in ongoing conflicts (best estimate)" by type, from
# the dataset grapher/war/latest/ucdp_preview.
CONFLICT_TYPES = [
    {"id": 1, "slug": "all", "name": "All armed conflicts", "indicatorId": 1012633},
    {"id": 2, "slug": "interstate", "name": "Interstate conflicts", "indicatorId": 1012634},
    {"id": 3, "slug": "intrastate", "name": "Intrastate conflicts", "indicatorId": 1012632},
    {"id": 4, "slug": "non-state", "name": "Non-state conflicts", "indicatorId": 1012638},
    {"id": 5, "slug": "one-sided", "name": "One-sided violence", "indicatorId": 1012637},
]

# Regions as in UCDP, in the order of their Gleditsch-Ward code ranges
REGIONS = [
    {"id": 1, "name": "Americas"},  # GW 2-199
    {"id": 2, "name": "Europe"},  # GW 200-399
    {"id": 3, "name": "Africa"},  # GW 400-626
    {"id": 4, "name": "Middle East"},  # GW 630-699
    {"id": 5, "name": "Asia and Oceania"},  # GW 700-999
]
REGION_NAMES = {r["name"] for r in REGIONS} | {"World"}

# Gleditsch-Ward codes of every country with recorded deaths since 1989
GW_CODES = {
    # Americas
    "United States": 2, "Canada": 20, "Haiti": 41, "Jamaica": 51,
    "Trinidad and Tobago": 52, "Mexico": 70, "Guatemala": 90, "Honduras": 91,
    "El Salvador": 92, "Nicaragua": 93, "Costa Rica": 94, "Panama": 95,
    "Colombia": 100, "Venezuela": 101, "Guyana": 110, "Ecuador": 130,
    "Peru": 135, "Brazil": 140, "Bolivia": 145, "Paraguay": 150, "Argentina": 160,
    # Europe
    "United Kingdom": 200, "Netherlands": 210, "Belgium": 211, "France": 220,
    "Spain": 230, "Germany": 260, "Poland": 290, "Austria": 305, "Albania": 339,
    "Serbia": 340, "Montenegro": 341, "North Macedonia": 343, "Croatia": 344,
    "Bosnia and Herzegovina": 346, "Kosovo": 347, "Slovenia": 349, "Moldova": 359,
    "Romania": 360, "Russia": 365, "Latvia": 367, "Lithuania": 368, "Ukraine": 369,
    "Armenia": 371, "Georgia": 372, "Azerbaijan": 373, "Sweden": 380,
    # Africa
    "Guinea-Bissau": 404, "Gambia": 420, "Mali": 432, "Senegal": 433, "Benin": 434,
    "Mauritania": 435, "Niger": 436, "Cote d'Ivoire": 437, "Guinea": 438,
    "Burkina Faso": 439, "Liberia": 450, "Sierra Leone": 451, "Ghana": 452,
    "Togo": 461, "Cameroon": 471, "Nigeria": 475, "Central African Republic": 482,
    "Chad": 483, "Congo": 484, "Democratic Republic of Congo": 490, "Uganda": 500,
    "Kenya": 501, "Tanzania": 510, "Burundi": 516, "Rwanda": 517, "Somalia": 520,
    "Djibouti": 522, "Ethiopia": 530, "Eritrea": 531, "Angola": 540,
    "Mozambique": 541, "Zambia": 551, "Zimbabwe": 552, "South Africa": 560,
    "Namibia": 565, "Lesotho": 570, "Botswana": 571, "Eswatini": 572,
    "Madagascar": 580, "Comoros": 581, "Morocco": 600, "Algeria": 615,
    "Tunisia": 616, "Libya": 620, "Sudan": 625, "South Sudan": 626,
    # Middle East
    "Iran": 630, "Turkey": 640, "Iraq": 645, "Egypt": 651, "Syria": 652,
    "Lebanon": 660, "Jordan": 663, "Israel": 666, "Saudi Arabia": 670,
    "Yemen": 678, "Kuwait": 690, "Bahrain": 692, "Qatar": 694,
    "United Arab Emirates": 696, "Oman": 698,
    # Asia and Oceania
    "Afghanistan": 700, "Tajikistan": 702, "Kyrgyzstan": 703, "Uzbekistan": 704,
    "China": 710, "India": 750, "Bhutan": 760, "Pakistan": 770, "Bangladesh": 771,
    "Myanmar": 775, "Sri Lanka": 780, "Nepal": 790, "Thailand": 800,
    "Cambodia": 811, "Laos": 812, "Malaysia": 820, "Philippines": 840,
    "Indonesia": 850, "East Timor": 860, "Australia": 900,
    "Papua New Guinea": 910, "Solomon Islands": 940,
}

# Places without a Gleditsch-Ward code of their own
REGION_WITHOUT_GW_CODE = {
    "Abyei": "Africa",  # contested between Sudan and South Sudan
    "Western Sahara": "Africa",  # mostly administered by Morocco
    "Palestine": "Middle East",  # within Israel's code range
}


def region_from_gw_code(code: int) -> str:
    if 2 <= code <= 199:
        return "Americas"
    if 200 <= code <= 399:
        return "Europe"
    if 400 <= code <= 626:
        return "Africa"
    if 630 <= code <= 699:
        return "Middle East"
    if 700 <= code <= 999:
        return "Asia and Oceania"
    raise ValueError(f"Invalid Gleditsch-Ward code: {code}")


def region_of(entity_name: str) -> str:
    if entity_name in REGION_WITHOUT_GW_CODE:
        return REGION_WITHOUT_GW_CODE[entity_name]
    if entity_name not in GW_CODES:
        raise KeyError(f"No region for '{entity_name}': add it to GW_CODES")
    return region_from_gw_code(GW_CODES[entity_name])


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url) as response:
        return json.load(response)


def fetch_indicator(indicator_id: int) -> dict[tuple[str, int], float]:
    """Return {(entity name, year): deaths} for one indicator."""
    metadata = fetch_json(f"{API}/{indicator_id}.metadata.json")
    data = fetch_json(f"{API}/{indicator_id}.data.json")
    names = {e["id"]: e["name"] for e in metadata["dimensions"]["entities"]["values"]}
    return {
        (names[entity], year): value
        for value, year, entity in zip(data["values"], data["years"], data["entities"])
        if FIRST_YEAR <= year <= LAST_YEAR
    }


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def build_metadata_fields(indicator_metadata: dict) -> dict:
    """Fields for the "methods and sources" modal (BespokeMetadataSchema)"""
    # Keep the stable sources only: preliminary data (2026) is not shown
    origins = [
        o for o in indicator_metadata["origins"] if "Candidate" not in o.get("title", "")
    ]
    return {
        "title": "Deaths in armed conflicts based on where they occurred",
        "descriptionShort": (
            "Best estimate of the number of deaths of combatants and civilians due to "
            "fighting in armed conflicts, by the country where the fighting took place."
        ),
        "descriptionKey": "\n".join(
            [
                "- An armed conflict is defined by the [Uppsala Conflict Data Program (UCDP)](https://ucdp.uu.se/) as a disagreement between organized groups, or between one organized group and civilians, that causes at least 25 deaths during a year. This includes combatant and civilian deaths due to fighting.",
                "- Deaths due to disease and starvation resulting from the conflict are not included.",
                "- UCDP distinguishes four types of armed conflict. Interstate conflicts are fought between states. Intrastate conflicts are fought between a state and a non-state armed group, such as a rebel group. Non-state conflicts are fought between non-state armed groups. One-sided violence is the use of armed force by a state or non-state armed group against civilians.",
                "- UCDP identifies conflict deaths [based on news reports, other contemporary sources, and academic research](https://www.uu.se/en/department/peace-and-conflict-research/research/ucdp/ucdp-methodology).",
                '- We show here the "best" death estimates as identified by UCDP. They also report high and low estimates.',
                "- Countries are grouped into the five regions UCDP uses: Africa, the Americas, Asia and Oceania, Europe, and the Middle East.",
            ]
        ),
        "descriptionProcessing": indicator_metadata.get("descriptionProcessing"),
        "origins": origins,
        "unit": "deaths",
        "timespan": f"{FIRST_YEAR}-{LAST_YEAR}",
        "attributionShort": "UCDP",
    }


class CorsRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Static file server that lets the dev server's pages fetch from it"""

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


def serve(directory: Path) -> None:
    handler = functools.partial(CorsRequestHandler, directory=str(directory))
    print(f"Serving {directory} at http://localhost:{PORT} (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()


def main() -> None:
    out_dir = SAMPLE_DATA_ROOT / ETL_STEP_PATH
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Download one indicator per conflict type
    deaths_by_type = {ct["slug"]: fetch_indicator(ct["indicatorId"]) for ct in CONFLICT_TYPES}
    indicator_metadata = fetch_json(f"{API}/{CONFLICT_TYPES[0]['indicatorId']}.metadata.json")

    # 2. Countries: every entity that is not an aggregate and has deaths in any year
    entity_names = sorted(
        {
            name
            for deaths in deaths_by_type.values()
            for (name, _), value in deaths.items()
            if name not in REGION_NAMES and value > 0
        }
    )
    region_id = {r["name"]: r["id"] for r in REGIONS}
    entities = [
        {"id": i + 1, "name": name, "region": region_id[region_of(name)]}
        for i, name in enumerate(entity_names)
    ]
    entity_id = {e["name"]: e["id"] for e in entities}

    # 3. Checks
    years = range(FIRST_YEAR, LAST_YEAR + 1)
    all_deaths = deaths_by_type["all"]
    for year in years:
        # Countries add up to the world total
        world = all_deaths.get(("World", year), 0)
        countries = sum(all_deaths.get((n, year), 0) for n in entity_names)
        check(world == countries, f"{year}: countries sum to {countries}, world is {world}")
        # The four types add up to "all", for every country
        for name in entity_names:
            parts = sum(deaths_by_type[s].get((name, year), 0) for s in deaths_by_type if s != "all")
            total = all_deaths.get((name, year), 0)
            check(parts == total, f"{name} {year}: types sum to {parts}, all is {total}")
    for deaths in deaths_by_type.values():
        check(all(v >= 0 for v in deaths.values()), "Negative death counts found")

    # Regions built from GW codes vs. the regional totals in the dataset. These
    # can differ slightly, because UCDP assigns a region to each conflict
    # rather than to the place where an event happened. Report, don't fail.
    differences = []
    for slug, deaths in deaths_by_type.items():
        for year in years:
            sums = defaultdict(float)
            for name in entity_names:
                sums[region_of(name)] += deaths.get((name, year), 0)
            for region in region_id:
                reference = deaths.get((region, year), 0)
                if sums[region] != reference:
                    differences.append((slug, year, region, sums[region], reference))
    print(f"Region totals differ from UCDP's own in {len(differences)} of "
          f"{len(deaths_by_type) * len(years) * len(region_id)} cases:")
    for slug, year, region, ours, theirs in differences:
        print(f"  {slug:10} {year} {region:17} ours={ours:>8.0f} ucdp={theirs:>8.0f}")

    # 4. Write files
    metadata = {
        **build_metadata_fields(indicator_metadata),
        "source": "Uppsala Conflict Data Program (2026); geoBoundaries (2023)",
        "timeRange": {"start": FIRST_YEAR, "end": LAST_YEAR},
        "regions": REGIONS,
        "entities": entities,
        "conflictTypes": [
            {"id": ct["id"], "slug": ct["slug"], "name": ct["name"]} for ct in CONFLICT_TYPES
        ],
    }
    (out_dir / "conflict-deaths.metadata.json").write_text(json.dumps(metadata, indent=2))

    for ct in CONFLICT_TYPES:
        rows = sorted(
            (year, entity_id[name], value)
            for (name, year), value in deaths_by_type[ct["slug"]].items()
            if name in entity_id and value > 0
        )
        data = {
            "values": [int(v) for _, _, v in rows],
            "entities": [e for _, e, _ in rows],
            "years": [y for y, _, _ in rows],
        }
        (out_dir / f"conflict-deaths.{ct['id']}.json").write_text(json.dumps(data))
        print(f"{ct['name']}: {len(rows)} non-zero country-years")

    print(f"Wrote {len(CONFLICT_TYPES) + 1} files to {out_dir}/ ({len(entities)} countries)")

    if "--serve" in sys.argv:
        serve(SAMPLE_DATA_ROOT)


if __name__ == "__main__":
    main()
