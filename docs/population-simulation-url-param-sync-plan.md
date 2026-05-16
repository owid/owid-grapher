# Population simulation URL parameter sync plan

## Goal

Make the **demography bespoke `simulation` variant** support shareable standalone URLs by syncing selected interactive state into query parameters.

Scope for the first version:

- Variant: `simulation` only
- Synced state:
    - selected country/entity
    - future assumption control points for fertility, life expectancy, and net migration
- Opt-in only, via GDoc bespoke component config
- Support external iframe embedding indirectly by making iframe `src` URLs carry the same state

Non-goals for the first version:

- Syncing `population`, `populationPyramid`, or `parameters` variants
- Syncing active assumption tab, pyramid year, or disclosure/open state
- Synchronizing iframe state with the parent page URL via `postMessage`
- Supporting multiple URL-synced demography simulations on one page

## Proposed GDoc API

```yaml
{.bespoke-component}
  bundle: demography
  variant: simulation
  size: widest
  {.config}
    urlSync: true
  {}
{}
```

`urlSync` should default to `false` so regular articles with multiple bespoke instances are unaffected.

## Query parameter design

Use demography-specific names to avoid collisions with Grapher params such as `country`, `time`, and `tab`.

Recommended params:

| Query param                | Meaning                                                           | Example       |
| -------------------------- | ----------------------------------------------------------------- | ------------- |
| `demographyCountry`        | Selected entity name                                              | `Japan`       |
| `demographyFertility`      | Fertility-rate assumptions for control years `[2030, 2050, 2100]` | `1.2,1.4,1.7` |
| `demographyLifeExpectancy` | Life-expectancy assumptions for `[2030, 2050, 2100]`              | `84,88,92`    |
| `demographyNetMigration`   | Net-migration-rate assumptions for `[2030, 2050, 2100]`           | `0,0,0`       |

The CSV order should match `CONTROL_YEARS` in `bespoke/projects/demography/src/helpers/constants.ts`.

Example share URL:

```text
/population-growth?demographyCountry=Japan&demographyFertility=1.2%2C1.4%2C1.7&demographyLifeExpectancy=84%2C88%2C92
```

## Authored config vs URL state

Treat authored GDoc config as the baseline and URL params as a user-state override.

For example:

```yaml
{.config}
  region: Japan
  fertilityRateAssumptions: 1.3,1.5,1.7
  urlSync: true
{}
```

means:

- Initial state comes from the authored config.
- Query params override that initial state on page load.
- URL writer should omit assumption params that equal the authored baseline.
- Reset buttons should reset to the authored baseline, not to the current URL state.

This is important because `useSimulation()` currently receives `initialScenarioOverrides` and treats them as its reset target. URL params should not be folded into those initial overrides.

## Implementation outline

### 1. Extend config parsing

Files:

- `bespoke/projects/demography/src/config.ts`

Add:

```ts
urlSync?: boolean
```

to `SimulationVariantConfig` only.

Parse it with the existing `parseBoolean()` helper:

```ts
urlSync: parseBoolean(raw.urlSync)
```

### 2. Add URL state helpers

Suggested new file:

- `bespoke/projects/demography/src/helpers/urlState.ts`

Responsibilities:

- Parse `window.location.search` into a typed demography URL state.
- Validate country/entity against metadata when metadata is available.
- Parse CSV assumption params into `Record<number, number>` keyed by `CONTROL_YEARS`.
- Serialize current state back to query params.
- Omit params equal to the authored baseline.
- Preserve unrelated query params when writing.

Suggested types:

```ts
export interface SimulationUrlState {
    entityName?: string
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}
```

### 3. Load URL state on mount

Files:

- `bespoke/projects/demography/src/variants/SimulationVariant.tsx`
- possibly `bespoke/projects/demography/src/helpers/useInitialEntityName.ts`

When `config.urlSync` is true:

1. Read `window.location.search` client-side.
2. Extract `demographyCountry` and assumption params.
3. Use `demographyCountry` as the initial selected entity if valid.
4. Use URL assumption params as current scenario params, while keeping authored config assumptions as the reset baseline.

Country handling detail:

- If `demographyCountry` is present, it should override `config.region` and user-location detection.
- If `demographyCountry` is absent, preserve current behavior.
- Avoid automatically writing user-location-detected countries to the URL before the user interacts. Otherwise a page loaded with `region: userLocation` could mutate the URL immediately and make accidental location-specific share URLs.

### 4. Keep authored assumptions separate from URL/current assumptions

Files:

- `bespoke/projects/demography/src/helpers/useSimulation.ts`
- `bespoke/projects/demography/src/components/SimulationContent.tsx`

Current model:

- `useSimulation(data, initialScenarioOverrides)` uses overrides as initial/reset baseline.
- User edits call `simulation.setScenarioParams(...)`.

Needed model:

- Authored config assumptions continue to be passed as `initialScenarioOverrides`.
- URL assumptions are applied as **current scenario params after initialization**, not as `initialScenarioOverrides`.

Possible implementation options:

1. Add an optional `initialCurrentScenarioOverrides` parameter to `useSimulation()`.
2. Or keep `useSimulation()` unchanged and apply URL assumptions in `SimulationContent` once `simulation.initialScenarioParams` is available.

Option 1 is cleaner and easier to test.

Important: when `data` or authored assumptions change, URL-provided current assumptions should be reapplied only if they came from the URL and have not been superseded by user interaction.

### 5. Write URL updates after user changes

Files:

- `bespoke/projects/demography/src/components/SimulationContent.tsx`
- `bespoke/projects/demography/src/variants/SimulationVariant.tsx`
- `bespoke/projects/demography/src/helpers/urlState.ts`

When `urlSync` is true, update the browser URL via `history.replaceState`, similar to Grapher’s `setWindowQueryStr` behavior.

Guidelines:

- Preserve unrelated query params.
- Remove demography params when state matches the authored baseline.
- Debounce writes while dragging assumption points.
- Do not create history entries for every drag movement.
- Avoid writing during initial hydration before URL state has been applied.

Recommended debounce: ~100–250ms. Grapher uses 100ms while animating.

### 6. Track explicit country changes

Country writes should be triggered by actual user country selection, not by automatic user-location resolution.

Possible approach:

- Wrap `setEntityName` in `SimulationVariant`.
- Track a `hasUserSelectedEntity` ref/state.
- If URL contained `demographyCountry`, consider country state URL-controlled and keep it serialized.
- If URL did not contain `demographyCountry`, only write the country param after user selection.

### 7. Tests

Add unit tests for URL helpers.

Suggested test cases:

- Parses valid CSV assumption params into `CONTROL_YEARS` records.
- Ignores invalid/missing/non-numeric CSV entries.
- Serializes only non-baseline assumptions.
- Preserves unrelated params.
- Removes demography params when reset to baseline.
- Does not use the un-namespaced `country` param.

If feasible, add a React test or lightweight integration test for:

- URL param assumptions load into current simulation state.
- Reset returns to authored config baseline and removes URL params.

## Files likely touched

- `bespoke/projects/demography/src/config.ts`
- `bespoke/projects/demography/src/variants/SimulationVariant.tsx`
- `bespoke/projects/demography/src/components/SimulationContent.tsx`
- `bespoke/projects/demography/src/helpers/useInitialEntityName.ts`
- `bespoke/projects/demography/src/helpers/useSimulation.ts`
- new: `bespoke/projects/demography/src/helpers/urlState.ts`
- new tests near `urlState.ts` and/or existing demography tests

## Edge cases

### Invalid country

If `demographyCountry` is not in metadata:

- Ignore it and fall back to current behavior.
- Do not crash or show a global error.
- On the next URL write, remove the invalid param.

### World and net migration

The simulation UI hides net migration for `World`. If `demographyNetMigration` is present for `World`, the safest first behavior is:

- Parse and preserve it internally only if the model supports it.
- Do not expose a broken UI.
- On write, omit `demographyNetMigration` if it is irrelevant or equal to baseline.

### Precision

Use each parameter’s existing display/editor precision:

- fertility: 1 decimal
- life expectancy: 0 decimals
- net migration: 1 decimal

Normalize serialized values to avoid URL churn from floating-point drag values.

### Browser support

Use `URLSearchParams`, `history.replaceState`, and ordinary React effects. These are compatible with the project’s supported browsers.

## Acceptance criteria

- A simulation block with `urlSync: true` loads country and assumptions from query params.
- User edits update the page URL without adding history entries for each drag.
- Resetting assumptions removes corresponding URL params if they match authored defaults.
- Normal article embeds without `urlSync: true` behave exactly as before.
- Only the `simulation` variant supports this behavior in the first version.
