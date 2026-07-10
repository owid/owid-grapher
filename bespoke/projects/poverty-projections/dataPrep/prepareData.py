#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas"]
# ///
"""Generate the committed projections JSON files for the poverty-projections viz.

Reads the four Stata files of the World Bank's "PIP Poverty Projections"
dataset (https://datacatalog.worldbank.org/search/dataset/0067066), aggregates
the country-level data into the seven World Bank regions — replicating the
aggregation of the OWID ETL step garden/wb/2026-03-25/poverty_projections —
and writes one file per poverty line to src/data/projections-{cents}.json.
The files are committed to the repo and loaded by the component at runtime.

To update to a newer vintage, replace the resource paths below with the ones
listed on the data catalog page and re-run.

Run with: uv run dataPrep/prepareData.py
"""

import json
import tempfile
import urllib.request
from pathlib import Path

import pandas as pd

BASE_URL = "https://datacatalogfiles.worldbank.org/ddh-published/0067066/"

# March 2026 vintage (2021 PPPs). The filenames embed the vintage, so cached
# downloads never go stale.
COUNTRY_BASELINE = "DR0096010/Country_FGT_1981_2050_20260324_2021_01_02_PROD.dta"
GLOBAL_BASELINE = "DR0096011/Global_FGT_1981_2050_20260324_2021_01_02_PROD.dta"
COUNTRY_SCENARIOS = (
    "DR0096012/Country_FGT_VariousScenarios_2027_2050_20260324_2021_01_02_PROD.dta"
)
GLOBAL_SCENARIOS = (
    "DR0096013/Global_FGT_VariousScenarios_2027_2050_20260324_2021_01_02_PROD.dta"
)

# Region names as used by the OWID ETL
# (garden/wb/2026-03-25/poverty_projections.countries.json)
REGION_NAMES = {
    "EAS": "East Asia and Pacific (WB)",
    "ECS": "Europe and Central Asia (WB)",
    "LCN": "Latin America and Caribbean (WB)",
    "MEA": "Middle East, North Africa, Afghanistan and Pakistan (WB)",
    "NAC": "North America (WB)",
    "SAS": "South Asia (WB)",
    "SSF": "Sub-Saharan Africa (WB)",
}
WORLD = "World"
ENTITIES = [WORLD, *sorted(REGION_NAMES.values())]

# Poverty lines in cents per day (2021 PPP). The source `povertyline` column
# is a float (3.0 / 4.2 / 8.3), matched via round(x * 100).
POVERTY_LINES_CENTS = [300, 420, 830]

FIRST_YEAR = 1990
LAST_YEAR = 2050
YEARS = list(range(FIRST_YEAR, LAST_YEAR + 1))

FIRST_PROJECTION_YEAR = 2027
SCENARIO_YEARS = list(range(FIRST_PROJECTION_YEAR, LAST_YEAR + 1))

# Scenario names as they appear in the source files, with the ids used in the
# committed JSON (must match SCENARIOS in PovertyProjectionsConstants.ts)
SCENARIOS = [
    ("2pct growth", "growth2pct"),
    ("4pct growth", "growth4pct"),
    ("6pct growth", "growth6pct"),
    ("8pct growth", "growth8pct"),
    ("2pct growth + 1% Gini reduction", "growth2pctGini1"),
    ("2pct growth + 2% Gini reduction", "growth2pctGini2"),
]

OUTPUT_DIR = Path(__file__).parent.parent / "src" / "data"

# When comparing the sum of the regional aggregates against the published
# World rows, accept a 0.5% relative or a 1-million-people absolute difference
WORLD_CHECK_RELATIVE_TOLERANCE = 0.005
WORLD_CHECK_ABSOLUTE_TOLERANCE = 1e6


def read_stata_cached(resource: str) -> pd.DataFrame:
    """Download a dataset resource (cached in the temp dir) and read it."""
    cache_dir = Path(tempfile.gettempdir()) / "pip-poverty-projections"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = cache_dir / Path(resource).name
    if not cached.exists():
        url = BASE_URL + resource
        print(f"Downloading {url} ...")
        urllib.request.urlretrieve(url, cached)
    return pd.read_stata(cached)


def to_line_cents(df: pd.DataFrame) -> pd.DataFrame:
    """Add a `line_cents` column and drop the poverty lines we don't use."""
    df = df.assign(line_cents=(df["povertyline"] * 100).round().astype(int))
    unexpected = set(df["line_cents"].unique()) - set(POVERTY_LINES_CENTS)
    assert not unexpected, f"Unexpected poverty lines: {unexpected}"
    return df


def aggregate_countries(df: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    """Sum country rows into aggregates, replicating the ETL garden step:
    sum `pop` and `poorpop` (in millions), then convert to people and
    compute the headcount ratio."""
    grouped = df.groupby(group_cols, as_index=False)[["pop", "poorpop"]].sum()
    grouped["pop"] = grouped["pop"] * 1e6
    grouped["poorpop"] = grouped["poorpop"] * 1e6
    grouped["ratio"] = grouped["poorpop"] / grouped["pop"] * 100
    return grouped


def check_against_world(
    regions: pd.DataFrame, world: pd.DataFrame, label: str, keys: list[str]
) -> None:
    """Assert that the sum of the regional aggregates matches the published
    World rows for every year and poverty line (and scenario)."""
    region_sums = regions.groupby(keys, as_index=False)[["pop", "poorpop"]].sum()
    merged = region_sums.merge(
        world[keys + ["pop", "poorpop"]], on=keys, suffixes=("_regions", "_world")
    )
    assert len(merged) == len(region_sums) == len(world), (
        f"{label}: region and World rows don't align "
        f"({len(region_sums)} vs {len(world)})"
    )
    for column in ["pop", "poorpop"]:
        diff = (merged[f"{column}_regions"] - merged[f"{column}_world"]).abs()
        relative = diff / merged[f"{column}_world"].clip(lower=1)
        ok = (relative < WORLD_CHECK_RELATIVE_TOLERANCE) | (
            diff < WORLD_CHECK_ABSOLUTE_TOLERANCE
        )
        assert ok.all(), (
            f"{label}: regional {column} sums don't match the published World "
            f"values:\n{merged[~ok]}"
        )


def build_matrix(
    df: pd.DataFrame, cents: int, years: list[int], column: str, decimals: int
) -> list[list[float]]:
    """Build the dense [entity][year] matrix for one poverty line."""
    subset = df[df["line_cents"] == cents]
    by_entity_year = subset.set_index(["entity", "year"])[column]
    matrix = []
    for entity in ENTITIES:
        row = []
        for year in years:
            value = by_entity_year.get((entity, year))
            assert value is not None and pd.notna(value), (
                f"Missing {column} for {entity} {year} at line {cents}"
            )
            row.append(round(float(value), decimals))
        matrix.append(row)
    return matrix


def build_scenario_matrices(
    df: pd.DataFrame, cents: int
) -> list[dict[str, object]]:
    scenarios = []
    for scenario_name, scenario_id in SCENARIOS:
        subset = df[df["scenario"] == scenario_name]
        scenarios.append(
            {
                "id": scenario_id,
                "headcountRatio": build_matrix(
                    subset, cents, SCENARIO_YEARS, "ratio", 4
                ),
                "poorPop": build_matrix(subset, cents, SCENARIO_YEARS, "poorpop", 0),
            }
        )
    return scenarios


def main() -> None:
    # --- Baseline ("current forecasts"): country file aggregated to regions,
    # --- World taken from the published global file
    country = to_line_cents(read_stata_cached(COUNTRY_BASELINE))
    country = country[country["year"].between(FIRST_YEAR, LAST_YEAR)]

    # The source labels each country-year as actual / nowcast / projection
    # (historical years between surveys are also labelled "projection").
    # The component encodes the boundary as a single firstProjectionYear, so
    # the forward years must all be projections and the nowcast must end
    # right before it.
    future = country[country["year"] >= FIRST_PROJECTION_YEAR]
    assert (future["estimate_type"] == "projection").all(), (
        "Expected all years >= "
        f"{FIRST_PROJECTION_YEAR} to be projections: "
        f"{future['estimate_type'].unique()}"
    )
    nowcast_years = set(
        country.loc[country["estimate_type"] == "nowcast", "year"].unique()
    )
    assert max(nowcast_years) == FIRST_PROJECTION_YEAR - 1, (
        f"Nowcast years {sorted(nowcast_years)} don't end right before "
        f"{FIRST_PROJECTION_YEAR}"
    )

    unexpected_regions = set(country["region_code"].unique()) - set(REGION_NAMES)
    assert not unexpected_regions, f"Unexpected regions: {unexpected_regions}"

    regions_baseline = aggregate_countries(
        country, ["region_code", "year", "line_cents"]
    )
    regions_baseline["entity"] = regions_baseline["region_code"].map(REGION_NAMES)

    world_baseline = to_line_cents(read_stata_cached(GLOBAL_BASELINE))
    world_baseline = world_baseline[
        world_baseline["year"].between(FIRST_YEAR, LAST_YEAR)
    ]
    assert (world_baseline["region_code"] == "WLD").all()
    world_baseline = world_baseline.assign(
        entity=WORLD,
        pop=world_baseline["pop"] * 1e6,
        poorpop=world_baseline["poorpop"] * 1e6,
    )
    world_baseline["ratio"] = (
        world_baseline["poorpop"] / world_baseline["pop"] * 100
    )

    check_against_world(
        regions_baseline, world_baseline, "baseline", ["year", "line_cents"]
    )
    baseline = pd.concat(
        [world_baseline, regions_baseline], ignore_index=True
    )[["entity", "year", "line_cents", "pop", "poorpop", "ratio"]]

    # --- Alternative scenarios: country file has no region column, so join
    # --- the ISO3 -> region mapping from the baseline country file
    code_to_region = country.drop_duplicates("code").set_index("code")[
        "region_code"
    ]
    country_scenarios = to_line_cents(read_stata_cached(COUNTRY_SCENARIOS))
    assert set(country_scenarios["scenario"].unique()) == {
        name for name, _ in SCENARIOS
    }, f"Unexpected scenarios: {set(country_scenarios['scenario'].unique())}"
    unmatched = set(country_scenarios["code"].unique()) - set(code_to_region.index)
    assert not unmatched, f"Country codes without a region: {unmatched}"

    country_scenarios["region_code"] = country_scenarios["code"].map(code_to_region)
    # The scenario files don't publish the number of poor
    country_scenarios["poorpop"] = (
        country_scenarios["fgt0"] * country_scenarios["pop"] / 100
    )
    regions_scenarios = aggregate_countries(
        country_scenarios, ["region_code", "scenario", "year", "line_cents"]
    )
    regions_scenarios["entity"] = regions_scenarios["region_code"].map(REGION_NAMES)

    world_scenarios = to_line_cents(read_stata_cached(GLOBAL_SCENARIOS))
    assert (world_scenarios["region_name"] == "World").all()
    world_scenarios = world_scenarios.assign(
        entity=WORLD,
        pop=world_scenarios["pop"] * 1e6,
    )
    world_scenarios["poorpop"] = (
        world_scenarios["fgt0"] * world_scenarios["pop"] / 100
    )
    world_scenarios["ratio"] = (
        world_scenarios["poorpop"] / world_scenarios["pop"] * 100
    )

    check_against_world(
        regions_scenarios,
        world_scenarios,
        "scenarios",
        ["scenario", "year", "line_cents"],
    )
    scenarios = pd.concat(
        [world_scenarios, regions_scenarios], ignore_index=True
    )[["entity", "scenario", "year", "line_cents", "pop", "poorpop", "ratio"]]

    # --- Sanity checks
    for df, label in [(baseline, "baseline"), (scenarios, "scenarios")]:
        assert df["ratio"].between(0, 100).all(), f"{label}: ratio out of [0, 100]"
        assert (df["poorpop"] >= 0).all(), f"{label}: negative poorpop"
        assert (df["pop"] > 0).all(), f"{label}: non-positive pop"

        # Poverty lines nest: a higher line can't have a lower ratio
        key_cols = [c for c in ["entity", "scenario", "year"] if c in df.columns]
        pivoted = df.pivot_table(
            index=key_cols, columns="line_cents", values="ratio"
        )
        assert (
            (pivoted[300] <= pivoted[420] + 1e-9)
            & (pivoted[420] <= pivoted[830] + 1e-9)
        ).all(), f"{label}: poverty lines don't nest"

    # --- Write one file per poverty line
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for cents in POVERTY_LINES_CENTS:
        output = {
            "povertyLineCents": cents,
            "entities": ENTITIES,
            "years": YEARS,
            "firstProjectionYear": FIRST_PROJECTION_YEAR,
            "headcountRatio": build_matrix(baseline, cents, YEARS, "ratio", 4),
            "poorPop": build_matrix(baseline, cents, YEARS, "poorpop", 0),
            "scenarioYears": SCENARIO_YEARS,
            "scenarios": build_scenario_matrices(scenarios, cents),
        }
        path = OUTPUT_DIR / f"projections-{cents}.json"
        path.write_text(json.dumps(output, separators=(",", ":")) + "\n")
        print(
            f"Wrote {path.name}: {len(ENTITIES)} entities, "
            f"{len(YEARS)} years ({YEARS[0]}-{YEARS[-1]}), "
            f"{len(SCENARIOS)} scenarios, {path.stat().st_size // 1024} KB"
        )

    # Spot-check values to compare against the published grapher chart
    # https://ourworldindata.org/grapher/projections-extreme-poverty-wb
    world_300 = baseline[
        (baseline["entity"] == WORLD) & (baseline["line_cents"] == 300)
    ].set_index("year")
    for year in [1990, 2024, 2030, 2050]:
        row = world_300.loc[year]
        print(
            f"World, $3 a day, {year}: {row['ratio']:.2f}% — "
            f"{row['poorpop'] / 1e6:,.1f} million people"
        )


if __name__ == "__main__":
    main()
