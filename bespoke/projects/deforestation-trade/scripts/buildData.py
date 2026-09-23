"""Build the runtime data files for the deforestation-trade bespoke viz.

Reads the lossless flow file (`deforestation-trade-flows.json`, the shared
`{timeRange, years, source, dimensions, flows}` schema) and writes the files the
bundle fetches at runtime:

    deforestation-trade.metadata.json   manifest, world totals + BespokeMetadata fields
    deforestation-trade.<entityId>.json one file per entity (imports + exports)

The output contract is `src/core/types.ts` (`RawFlowBlock`, `RawCountryJson`,
`RawMetadataJson`).

STOPGAP. Data generation for bespoke projects is meant to live in an export step
in the owid/etl repo, and this script will be ported there. To keep that port
cheap it is Python 3 standard library only (json, argparse, pathlib,
collections) with no imports from this repo, and no dependency on anything but
the input file.

Usage:
    uv run python scripts/buildData.py <input.json> [<outdir>]
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

# The input's `dimensions.metrics` has two metrics; the viz only shows hectares.
HECTARES_METRIC_INDEX = 0

# Hectare values are rounded to this many decimals, matching the input file.
DECIMALS = 1

FILE_PREFIX = "deforestation-trade"

Values = list  # list[float | None], aligned to `years`


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------


def build_world_totals(
    flows: list[tuple[int, int, int, Values]], group_ids: list[int], num_years: int
) -> list[dict]:
    """Worldwide hectares per commodity group, aligned to `years`: the sum of
    every flow, each counted once (a flow is one producer and one consumer)."""
    sums = {group_id: [0.0] * num_years for group_id in group_ids}
    for _producer, _consumer, group, values in flows:
        for i, v in enumerate(values):
            if v is not None:
                sums[group][i] += v
    return [
        {
            "commodityGroup": group_id,
            "values": [round(v, DECIMALS) for v in sums[group_id]],
        }
        for group_id in group_ids
    ]


def build_metadata(raw: dict, flows: list[tuple[int, int, int, Values]]) -> dict:
    """The manifest (years, dimensions, world totals) plus the
    `BespokeMetadataSchema` fields that feed the methods-and-sources box."""
    time_range = raw["timeRange"]
    source = raw["source"]
    group_ids = [g["id"] for g in raw["dimensions"]["commodityGroups"]]
    return {
        "timeRange": time_range,
        "years": raw["years"],
        "source": source,
        "dimensions": {
            "entities": raw["dimensions"]["entities"],
            "commodityGroups": raw["dimensions"]["commodityGroups"],
        },
        "worldTotals": build_world_totals(flows, group_ids, len(raw["years"])),
        "title": "Deforestation embedded in agricultural trade",
        "descriptionShort": (
            "Hectares of amortized deforestation risk embedded in agricultural "
            "commodities, attributed to both the producing and the consuming country."
        ),
        "descriptionKey": (
            "Deforestation risk embedded in trade is an estimate of how much "
            "deforestation is associated with the agricultural commodities a "
            "country produces or consumes. It is calculated with a physical trade "
            "model that attributes deforestation in producing countries to the "
            "countries that ultimately consume those commodities. It therefore "
            "measures exposure, and does not confirm that a given shipment was "
            "sourced from a specific cleared area. Deforestation is amortized over "
            "a multi-year window following the DeDuCE model, so a single clearing "
            "event is spread across several years. The estimates cover cropland "
            "and pasture expansion for agricultural commodities."
        ),
        "attribution": (
            "Singh, Persson, Croft, Kastner & West (2026) via "
            "DeforestationFootprint.earth"
        ),
        "attributionShort": "DeforestationFootprint.earth",
        "origins": [
            {
                "producer": "Singh, Persson, Croft, Kastner & West",
                "title": "DeDuCE model and physical trade model",
                "citationFull": source,
                "urlMain": "https://deforestationfootprint.earth/trade",
                "datePublished": "2026",
                "license": {
                    "name": "CC BY 4.0",
                    "url": "https://creativecommons.org/licenses/by/4.0/",
                },
            }
        ],
        "unit": "hectares",
        "shortUnit": "ha",
        "timespan": f"{time_range['start']}-{time_range['end']}",
        # Must be a `LicenseOption` enum value, see GrapherTypes.ts
        "license": "cc-by",
    }


# ---------------------------------------------------------------------------
# Flows
# ---------------------------------------------------------------------------


def hectare_values(flow: dict) -> Values:
    """The per-year hectare array of a flow, rounded, `null` kept as `None`."""
    return [
        None if v is None else round(v, DECIMALS)
        for v in flow["values"][HECTARES_METRIC_INDEX]
    ]


def is_empty(values: Values) -> bool:
    """True if the flow has no hectare value in any year."""
    return all(v is None or v == 0 for v in values)


def total(values: Values) -> float:
    return sum(v for v in values if v is not None)


def load_flows(raw: dict) -> list[tuple[int, int, int, Values]]:
    """`(producer, consumer, commodityGroup, values)` for every non-empty flow."""
    flows = []
    for flow in raw["flows"]:
        values = hectare_values(flow)
        if is_empty(values):
            continue
        flows.append(
            (flow["producer"], flow["consumer"], flow["commodityGroup"], values)
        )
    return flows


def make_block(rows: list[tuple[int, int, Values]]) -> dict:
    """A `RawFlowBlock` from `(partner, group, values)` rows, biggest first."""
    rows = sorted(rows, key=lambda row: total(row[2]), reverse=True)
    return {
        "partners": [partner for partner, _, _ in rows],
        "groups": [group for _, group, _ in rows],
        "values": [values for _, _, values in rows],
    }


def build_country_files(
    flows: list[tuple[int, int, int, Values]],
    all_entity_ids: list[int],
) -> dict[int, dict]:
    """One `RawCountryJson` per metadata entity, including those without flows.

    Domestic flows (producer == consumer) land in both blocks.
    """
    imports: dict[int, list] = defaultdict(list)
    exports: dict[int, list] = defaultdict(list)
    for producer, consumer, group, values in flows:
        imports[consumer].append((producer, group, values))
        exports[producer].append((consumer, group, values))

    entity_ids = sorted(set(all_entity_ids) | set(imports) | set(exports))
    return {
        entity_id: {
            "imports": make_block(imports.get(entity_id, [])),
            "exports": make_block(exports.get(entity_id, [])),
        }
        for entity_id in entity_ids
    }


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def write_json(path: Path, payload: object) -> int:
    """Write compact JSON and return the byte size."""
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="deforestation-trade-flows.json")
    parser.add_argument(
        "outdir",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parent.parent / "data",
        help="output directory (default: <project>/data)",
    )
    args = parser.parse_args()

    raw = json.loads(args.input.read_text(encoding="utf-8"))
    years: list[int] = raw["years"]
    flows = load_flows(raw)

    outdir: Path = args.outdir
    outdir.mkdir(parents=True, exist_ok=True)

    write_json(outdir / f"{FILE_PREFIX}.metadata.json", build_metadata(raw, flows))

    countries = build_country_files(
        flows, [entity["id"] for entity in raw["dimensions"]["entities"]]
    )
    sizes: dict[int, int] = {}
    for entity_id, payload in countries.items():
        sizes[entity_id] = write_json(
            outdir / f"{FILE_PREFIX}.{entity_id}.json", payload
        )

    # --- summary -----------------------------------------------------------
    entity_name = {e["id"]: e["name"] for e in raw["dimensions"]["entities"]}
    last_year_index = years.index(max(years))
    largest_id = max(sizes, key=lambda entity_id: sizes[entity_id])

    brazil_id = next(
        (e["id"] for e in raw["dimensions"]["entities"] if e["iso"] == "BRA"), None
    )
    brazil_exports = 0.0
    if brazil_id is not None:
        block = countries[brazil_id]["exports"]
        brazil_exports = sum(
            values[last_year_index] or 0
            for partner, values in zip(block["partners"], block["values"])
            if partner != brazil_id
        )

    print(f"Input flows: {len(raw['flows'])}, kept: {len(flows)}")
    print(f"Entity files written: {len(countries)} -> {outdir}")
    print(
        f"Largest entity file: {FILE_PREFIX}.{largest_id}.json "
        f"({entity_name.get(largest_id, '?')}, {sizes[largest_id]:,} bytes)"
    )
    print(f"{max(years)} Brazil cross-border exports: {brazil_exports:,.1f} ha")


if __name__ == "__main__":
    main()
