# Dumbbell Chart Type — Integration Checklist

## A. TypeScript errors (caught by typechecker)

- [x] `packages/@ourworldindata/grapher/src/chart/ChartTabs.ts` — Add Dumbbell to `CHART_TYPE_LABEL`
- [x] `packages/@ourworldindata/grapher/src/chart/ChartTabs.ts` — Add Dumbbell to `LONG_CHART_TYPE_LABEL`
- [x] `packages/@ourworldindata/grapher/src/chart/ChartTabs.ts` — Add `dumbbell` to `MAP_CHART_TAB_CONFIG_OPTION_TO_CHART_TYPE_NAME`
- [x] `packages/@ourworldindata/components/src/GrapherTabIcon.tsx` — Add Dumbbell to `chartIcons` record (placeholder icon)
- [x] `packages/@ourworldindata/grapher/src/color/ColorSchemes.ts` — Add Dumbbell case to `.exhaustive()` match in `getPreferredSchemesByType`
- [x] `functions/_common/search/constructSearchResultDataTableContent.ts` — Add Dumbbell case to `.exhaustive()` match
- [x] `devTools/svgTester/chart-configurations.ts` — Add Dumbbell to two `Record<ChartType, ...>` objects

## B. Silent failures (NOT caught by typechecker)

### B1. Critical: ChartTypeMap.tsx — silent fallback to LineChart

- [x] `packages/@ourworldindata/grapher/src/chart/ChartTypeMap.tsx` — Add Dumbbell to `ChartComponentClassMap`
- [x] `packages/@ourworldindata/grapher/src/chart/ChartTypeMap.tsx` — Add Dumbbell to `ChartThumbnailClassMap`
- [x] `packages/@ourworldindata/grapher/src/chart/ChartTypeMap.tsx` — Add Dumbbell to `ChartStateMap`

### B2. Critical: GrapherState.tsx — missing boolean getters

- [x] `packages/@ourworldindata/grapher/src/core/GrapherState.tsx` — Add `isDumbbell` computed getter
- [x] `packages/@ourworldindata/grapher/src/core/GrapherState.tsx` — Add `isOnDumbbellTab` computed getter
- [x] `packages/@ourworldindata/grapher/src/core/GrapherState.tsx` — Add `hasDumbbell` computed getter

### B3. EditorFeatures.tsx — feature flag getters

- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canCustomizeXAxisScale` (dumbbell has no x axis scale)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canCustomizeXAxisLabel` (dumbbell has no x axis)
- [x] `adminSiteClient/EditorFeatures.tsx` — `canEnableLogLinearToggle`
- [x] `adminSiteClient/EditorFeatures.tsx` — `canSelectTimeRange`
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canHideSeriesLabels` (not applicable)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `relativeModeToggle` (no relative mode)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canSpecifyCustomComparisonLines` (not applicable)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canSpecifyVerticalComparisonLines` (not applicable)
- [x] `adminSiteClient/EditorFeatures.tsx` — `canSpecifySortOrder`
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canSortByColumn` (not applicable)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canSpecifyMissingDataStrategy` (not applicable)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `showChangeInPrefixToggle` (no relative mode)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `showTimeAnnotationInTitleToggle` (default behavior is fine)
- [n/a] `adminSiteClient/EditorFeatures.tsx` — `canHighlightSeries` (default behavior is fine)

### B4. SettingsMenu.tsx — array `.includes()` checks

- [x] `packages/@ourworldindata/grapher/src/controls/SettingsMenu.tsx` — `showYScaleToggle` (excluded, like DiscreteBar)
- [n/a] `packages/@ourworldindata/grapher/src/controls/SettingsMenu.tsx` — `showAbsRelToggle` (no relative mode, not in list = correct)
- [n/a] `packages/@ourworldindata/grapher/src/controls/SettingsMenu.tsx` — `showFacetControl` (no faceting, not in list = correct)

### B5. EditorBasicTab.tsx — default application

- [n/a] `adminSiteClient/EditorBasicTab.tsx` — `applyDefaultsForPrimaryChartType` (no special defaults needed)

### B6. Admin editor tabs

- [n/a] `adminSiteClient/IndicatorChartEditor.ts` — `availableTabs` (no custom editor tab needed)
- [n/a] `adminSiteClient/NarrativeChartEditor.ts` — `availableTabs` (no custom editor tab needed)

### B7. ChartTabs.ts — dimension support

- [n/a] `packages/@ourworldindata/grapher/src/chart/ChartTabs.ts` — `getSupportedDimensionsForChartTypes` (falls through to `[y]` which is correct)

### B8. Other locations

- [n/a] `baker/updateChartEntities.ts` — `chartTypeShowsUnselectedEntities` (dumbbell doesn't show unselected entities)
- [n/a] `adminSiteClient/EditorDataTab.tsx` — `isChartTypeThatShowsAllEntities` (not applicable)
- [n/a] `functions/_common/search/constructSearchResultJson.ts` — entity picking (not applicable)
- [n/a] `packages/@ourworldindata/utils/src/Util.ts` — ScatterPlot-only check (not applicable)
- [x] `db/docs/chart_configs.yml` — schema docs updated
- [x] `packages/@ourworldindata/grapher/src/schema/grapher-schema.010.yaml` — schema updated
- [x] `packages/@ourworldindata/grapher/src/schema/grapher-schema.010.json` — schema updated

### B9. Chart type combinations

- [n/a] `packages/@ourworldindata/grapher/src/chart/ChartTabs.ts` — `VALID_CHART_TYPE_COMBINATIONS` (Dumbbell is standalone, correct as-is)

## C. Additional work completed

- [x] `packages/@ourworldindata/grapher/src/dumbbellCharts/` — Stub chart component, thumbnail, and full state class
- [x] `packages/@ourworldindata/grapher/src/dumbbellCharts/DumbbellChartState.test.ts` — Test suite (7 tests)
- [x] `packages/@ourworldindata/grapher/src/index.ts` — Export `DumbbellChartState` type
- [x] `functions/_common/search/constructSearchResultDataTableContent.ts` — Full data table builder implementation

## D. Remaining work (future)

- [ ] Replace placeholder tab icon with designed dumbbell icon
- [ ] Implement actual DumbbellChart rendering component (currently shows placeholder text)
- [ ] Implement actual DumbbellChartThumbnail rendering
- [ ] Pick final preferred color schemes for dumbbell plots
