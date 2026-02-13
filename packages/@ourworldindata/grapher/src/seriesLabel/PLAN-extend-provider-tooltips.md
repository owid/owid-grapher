# Plan: Extend tooltip support to all providers with `definedBy`

## Current state

- **Supported**: wb, un, who, unsdg, pew (5 geographic providers) + incomeGroups
- **Not supported**: un_m49_1, un_m49_2, un_m49_3

These 3 are the only providers in regions.json with `definedBy` that lack tooltip support. All other `AnyRegionDataProvider` values (fao, ei, pip, etc.) don't appear as `definedBy` in regions.json, so they're out of scope.

## Key challenge

There's a mismatch for un_m49 providers: entities like "Africa (UN M49)" parse to suffix providerKey `"unm49"`, but their region's `definedBy` is `"un_m49_1"`. The current `hasProviderTooltipData` receives `"unm49"` and can never match `"un_m49_1"`.

## Changes by file

### 1. `RegionProviderTooltipData.ts` — Main changes

- Remove hardcoded `providersWithTooltipData` array and the `RegionProviderWithTooltipData` type
- Change `TooltipKey` to `RegionDataProvider | "incomeGroups"` (covers all 8 providers)
- Add descriptions for un_m49_1, un_m49_2, un_m49_3 to `descriptionsByKey`
- Add display ordering for un_m49_1, un_m49_2, un_m49_3 to `regionDisplayOrder`
- Restructure `hasProviderTooltipData` → new function `getTooltipKeyForEntity(entityName): TooltipKey | undefined` that:
    - Looks up the entity in regions.json via `getRegionByName`
    - If it's an aggregate and `definedBy` is a `RegionDataProvider`, returns `definedBy` as the tooltip key
    - This correctly maps "Africa (UN M49)" → definedBy "un_m49_1"
- Keep the existing `getTooltipData(key)` function, which will now work for all providers

### 2. `SeriesLabelState.ts` — Use new gating function

- Replace `hasProviderTooltipData(providerKey, this.options.text)` with `getTooltipKeyForEntity(this.options.text)`
- Use the returned tooltip key (from `definedBy`) instead of suffix-parsed `providerKey` for `tooltipKey` on the icon fragment
- This naturally handles the un_m49 mismatch: suffix is "unm49" but tooltipKey becomes "un_m49_1"

### 3. `CustomSchemes.ts` — Add colors for un_m49 regions

- un_m49_1 has 5 top-level regions (Africa, Americas, Asia, Europe, Oceania) — these can reuse/derive colors from existing continent colors
- un_m49_2 has ~12 intermediate regions — need new colors
- un_m49_3 has ~12 detailed regions — need new colors
- Each region name has "(UN M49)" suffix, so entries like `"Africa (UN M49)": "#..."` need to be added

## What stays the same

- `RegionProviderTooltip.tsx` — no changes needed
- `RegionProviderMap.tsx` — no changes needed
- `SeriesLabel.scss` — no changes needed
- `SeriesLabel.tsx` — no changes needed (already renders any `TooltipKey`)
- Income group handling stays the same (detected separately via `checkIsOwidIncomeGroupName`)

## Open questions

- **Colors for un_m49_2 and un_m49_3**: These have many regions (12+ each). Need to pick distinct colors from a palette, similar to how existing providers use ContinentColors.
- **Descriptions for un_m49 providers**: Write descriptions following the same pattern as existing ones, with links to the M49 documentation page.

## Reference: un_m49 regions in regions.json

All have suffix "(UN M49)" in their entity name.

**un_m49_1** (5 top-level):
Africa, Americas, Asia, Europe, Oceania

**un_m49_2** (~12 intermediate):
Caribbean, Central America, Central Asia, Eastern Africa, Eastern Asia, Eastern Europe, Middle Africa, Northern Africa, Northern America, Northern Europe, South America, South-eastern Asia, Southern Africa, Southern Asia, Southern Europe, Western Africa, Western Asia, Western Europe

**un_m49_3** (~5 sub-regions):
Australia and New Zealand, Latin America and the Caribbean, Melanesia, Micronesia, Polynesia, Sub-Saharan Africa
