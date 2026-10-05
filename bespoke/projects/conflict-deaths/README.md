# Conflict deaths treemap

A treemap of deaths in armed conflicts, based on UCDP data from 1989 to 2025. Each tile is a country, sized by the number of deaths in the fighting that took place there that year, and colored by its UCDP region. Readers pick a conflict type (all armed conflicts, interstate, intrastate, non-state, one-sided violence) and a year.

It is a copy of the `causes-of-death` treemap, adapted. The two share no code on purpose, so changes to one don't affect the other.

## Embedding

```yaml
{.bespoke-component}
  bundle: conflict-deaths
  variant: treemap
  {.config}
    conflictType: all   # all, interstate, intrastate, non-state, one-sided
    year: 2025          # defaults to the latest year
  {}
{}
```

`hideControls: true` hides the dropdown and time slider.

## Data

The registry points to `war/latest/ucdp_conflict_deaths_treemap`, an ETL export step that **does not exist yet**. Until it does, `scripts/build_sample_data.py` builds files with the same shape from our public UCDP indicators:

```bash
# Terminal 1: build the files and serve them at http://localhost:8100
python3 bespoke/projects/conflict-deaths/scripts/build_sample_data.py --serve

# Terminal 2: start the dev server, reading data from there
BESPOKE_DATA_URL=http://localhost:8100 yarn startBespokeDevServer
```

Then open http://localhost:8089/conflict-deaths/demo. The files land in `sample-data/` (git-ignored).

### Files

`conflict-deaths.metadata.json`:

- `source`: the citation shown in the chart footer
- `timeRange`: `{ "start": 1989, "end": 2025 }`
- `regions`: `[{ "id", "name" }]`, the five UCDP regions
- `entities`: `[{ "id", "name", "region" }]`, every country with recorded deaths, with its region's id
- `conflictTypes`: `[{ "id", "slug", "name" }]`, in dropdown order. The slugs `all`, `interstate`, `intrastate`, `non-state` and `one-sided` are used in the block config and the URL.
- the `BespokeMetadataSchema` fields (`title`, `descriptionShort`, `descriptionKey`, `origins`, …) for the "Learn more about this data" modal

`conflict-deaths.<conflictTypeId>.json`, one per conflict type: parallel arrays `{ "values", "entities", "years" }` with only the non-zero deaths. A country-year that's missing had no recorded deaths.

### Notes for the ETL step

- Use the country-level "deaths in ongoing conflicts (best estimate)" by where the fighting happened, from the stable UCDP dataset (`garden/war/<version>/ucdp`), not `ucdp_preview`: the preview adds incomplete data for the current year.
- "All armed conflicts" is the `all` conflict type. For 1989–2025 it equals interstate + intrastate + non-state + one-sided, for every country (extrasystemic conflicts have no deaths after 1989). The sample script checks this.
- Assign regions with `add_region_from_code` (Gleditsch-Ward code ranges) in `etl/steps/data/garden/war/<version>/shared.py`. Abyei and Western Sahara have no code and go to Africa, Palestine goes to the Middle East.
- Built this way, the region totals match UCDP's own regional totals in 909 of 925 region-year-type cases. The rest differ by up to 171 deaths, because UCDP gives each conflict a region, which can differ from the region of the country where an event took place (e.g. in 1989–90).
