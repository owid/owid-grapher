#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb"]
# ///
"""Generate the committed headcount JSON files for the where-are-the-poor viz.

Reads the World Bank PIP poverty table from the public OWID catalog and writes
one file per poverty line to src/data/headcounts-{cents}.json. The files are
committed to the repo and loaded by the component at runtime.

Run with: uv run dataPrep/prepareData.py
"""

import json
from pathlib import Path

import duckdb

PARQUET_URL = "https://catalog.ourworldindata.org/garden/wb/2026-06-26/world_bank_pip/poverty.parquet"

# Poverty lines in cents per day (2021 PPP), matching the poverty_pip MDim
POVERTY_LINES_CENTS = [100, 300, 420, 830, 1000, 2000, 3000, 4000]

OUTPUT_DIR = Path(__file__).parent.parent / "src" / "data"

QUERY = f"""
SELECT
    country,
    year,
    CAST(poverty_line AS INTEGER)    AS line_cents,
    CAST(round(headcount) AS BIGINT) AS headcount
FROM read_parquet('{PARQUET_URL}')
WHERE ppp_version = 2021
  AND "table" = 'Income or consumption intra/extrapolated'
  AND welfare_type = 'income or consumption'
  AND poverty_line IN ({", ".join(f"'{cents}'" for cents in POVERTY_LINES_CENTS)})
  AND headcount IS NOT NULL
  AND country NOT IN ('World', 'World (excluding China)', 'World (excluding India)')
  AND country NOT LIKE '%(WB)%'
ORDER BY country, year
"""


def consolidate_urban_rural(countries: set[str]) -> dict[str, str]:
    """Map each entity to the country name it should be published under.

    National series are preferred. If a country only has an urban or rural
    series (e.g. "Argentina (urban)"), that series is used as national data.
    Entities that shouldn't be included (e.g. "China (urban)" when national
    "China" exists) are omitted from the mapping.
    """
    mapping: dict[str, str] = {}
    variants: dict[str, list[str]] = {}
    for country in countries:
        for suffix in (" (urban)", " (rural)"):
            if country.endswith(suffix):
                base = country.removesuffix(suffix)
                variants.setdefault(base, []).append(country)
                break
        else:
            mapping[country] = country

    for base, base_variants in variants.items():
        if base in mapping:
            continue  # national series exists; drop the variants
        if len(base_variants) == 1:
            mapping[base_variants[0]] = base
            print(f'Using "{base_variants[0]}" as national data for "{base}"')
        else:
            print(
                f"WARNING: skipping {base_variants} — urban and rural series "
                f'exist but no national series for "{base}"'
            )

    return mapping


def main() -> None:
    print(f"Fetching {PARQUET_URL} ...")
    rows = duckdb.sql(QUERY).fetchall()
    print(f"Fetched {len(rows)} rows")

    # Prefer national series; fall back to a lone urban/rural series
    country_mapping = consolidate_urban_rural({country for country, *_ in rows})

    # {line_cents: {country: {year: headcount}}}
    by_line: dict[int, dict[str, dict[int, int]]] = {
        cents: {} for cents in POVERTY_LINES_CENTS
    }
    for country, year, line_cents, headcount in rows:
        assert headcount >= 0, f"Negative headcount: {country} {year} {line_cents}"
        published_name = country_mapping.get(country)
        if published_name is None:
            continue
        by_line[line_cents].setdefault(published_name, {})[year] = headcount

    # All lines must cover the same countries and the same year range
    country_sets = {cents: set(data.keys()) for cents, data in by_line.items()}
    reference_countries = country_sets[POVERTY_LINES_CENTS[0]]
    for cents, countries in country_sets.items():
        assert countries == reference_countries, (
            f"Country set for {cents} differs: "
            f"{countries ^ reference_countries}"
        )

    all_years = sorted({year for _, year, _, _ in rows})
    years = list(range(min(all_years), max(all_years) + 1))
    assert all_years == years, f"Years are not contiguous: {all_years}"

    countries = sorted(reference_countries)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for cents in POVERTY_LINES_CENTS:
        values = [
            [by_line[cents][country].get(year) for year in years]
            for country in countries
        ]
        num_missing = sum(value is None for row in values for value in row)

        output = {
            "povertyLineCents": cents,
            "years": years,
            "countries": countries,
            "values": values,
        }
        path = OUTPUT_DIR / f"headcounts-{cents}.json"
        path.write_text(json.dumps(output, separators=(",", ":")) + "\n")
        print(
            f"Wrote {path.name}: {len(countries)} countries, "
            f"{len(years)} years ({years[0]}-{years[-1]}), "
            f"{num_missing} missing values, {path.stat().st_size // 1024} KB"
        )


if __name__ == "__main__":
    main()
