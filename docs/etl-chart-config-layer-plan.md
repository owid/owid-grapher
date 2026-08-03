# Plan: the ETL chart-config layer in the admin editor

_Re: [#6826](https://github.com/owid/owid-grapher/pull/6826) (ETL-authored chart
configs, addressed by chart config UUID), which rebases
[#6553](https://github.com/owid/owid-grapher/pull/6553). Not a blocker for
either — this is about how the new layer is modelled in the admin editor._

## Context: the config layer stack

With #6826 a chart's rendered config is a four-layer merge:

| layer            | stored as                                                    | applied when                  |
| ---------------- | ------------------------------------------------------------ | ----------------------------- |
| grapher defaults | code (`defaultGrapherConfig`)                                | always                        |
| indicator config | `variables.grapherConfigAdmin ?? variables.grapherConfigETL` | `charts.isInheritanceEnabled` |
| chart ETL config | `chart_configs` row via `charts.configIdETL` (new)           | whenever the row exists       |
| admin patch      | `chart_configs` row via `charts.configId` (`patch`)          | always                        |

The server has one name for the two middle layers together — `parentStack`
(`adminSiteServer/apiRoutes/charts.ts:474`) — and computes
`full = merge(parentStack, patch)`, diffing an incoming config against the same
stack to derive `patch`.

## Problem

`GET /charts/:id.parent.json` returns the two middle layers separately
(`variableConfig`, `etlConfig`) and the editor keeps them as two raw fields on
`AbstractChartEditorManager` (`adminSiteClient/AbstractChartEditor.ts:55-70`).
Every consumer then re-does the merge itself, and each one has to remember both
layers plus the `isInheritanceEnabled` gate that applies to only one of them.

Two call sites already forgot the new layer:

- `ChartEditor.updateParentConfig` (`adminSiteClient/ChartEditor.ts:160`) —
  changing an ETL-managed chart's indicator calls
  `updateLiveGrapher(merge(newParentConfig, patchConfig))`, dropping `etlConfig`.
- `EditorDebugTab.onToggleInheritance` (`adminSiteClient/EditorDebugTab.tsx:79`) —
  toggling inheritance rebuilds the live config from `parentConfig` only, same
  drop.

In both cases `grapherState.reset()` then wipes ETL-authored title/subtitle/etc.
from the preview. Nothing is lost on save (the server recomputes `full` from the
stack), but the preview stops matching what will be saved.

The naming makes this easy to get wrong. `parentConfig` already means three
different things across the editor variants:

- `ChartEditorPage` — the indicator's resolved grapher config
- `IndicatorChartEditorPage.tsx:66` — the variable's `grapherConfigETL` (i.e. a
  `parentConfig` that _is_ an ETL config, unrelated to the new `etlConfig`)
- `NarrativeChartEditorPage.tsx:61` — the parent chart's full config

So "`parentConfig` and `etlConfig` side by side" reads as two names for the same
kind of thing, when what actually differs is each layer's lifecycle.

## Why the two inputs can't just be pre-merged server-side

Tempting, but four things treat the layers differently:

1. **Toggleability.** `isInheritanceEnabled` governs only the indicator layer;
   the ETL layer is always applied. `onToggleInheritance` subtracts the
   indicator layer by rebuilding from it alone — impossible if it arrives
   pre-merged, short of a re-fetch on every toggle.
2. **Different resolution lifecycle.** The indicator layer is _derived from the
   chart's dimensions_ and re-fetched client-side whenever the y-dimension
   changes (`ChartEditor.updateParentConfig`). `etlConfig` is pinned to the chart
   row and constant for the session. A merged field would have to be re-split on
   every re-fetch. Worse, that method's change detection reads
   `parentConfig?.dimensions?.[0].variableId` to mean "which indicator do I
   inherit from" — with a merged config, `dimensions` would come from `etlConfig`
   (that is where ETL charts keep them), so the check would read the wrong layer.
3. **`saveAsNewGrapher` must fold in exactly the ETL layer and not the indicator
   one** (`ChartEditor.ts:222`): the copy keeps inheriting from the indicator but
   gets no ETL row. That split can't be recovered from a merged parent.
4. **UI attribution.** The debug tab renders `parentConfig` under "Parent config"
   with an "Edit parent config in the admin" link. ETL-authored fields aren't
   admin-editable at all, so merging them into that textarea mislabels them.

Everything _downstream_ of the merge, though, only ever wants one config:
`fullConfig`, `patchConfig`, `isPropertyInherited`, `canPropertyBeInherited`,
`EditorMapTab`.

## Proposal: two raw inputs, one computed parent

Keep both layers as inputs, make the merged value the only thing the rest of the
editor sees, and rename so the pair stops reading as redundant:

```ts
// AbstractChartEditorManager: raw layers, distinct names
variableConfig?: GrapherInterface // was `parentConfig`; matches the server's field name
etlConfig?: GrapherInterface

// AbstractChartEditor: layers in, one effective parent out
protected abstract get parentLayers(): GrapherInterface[]
@computed get parentConfig(): GrapherInterface | undefined {
    const merged = mergeGrapherConfigs(...this.parentLayers)
    return _.isEmpty(merged) ? undefined : merged
}
```

Per variant:

- `ChartEditor` → `[isInheritanceEnabled ? variableConfig : {}, etlConfig]`
- `IndicatorChartEditor` → `[variableEtlConfig]`
- `NarrativeChartEditor` → `[parentChartFullConfig]`

What this removes:

- the `_.isEmpty(variablePart) && _.isEmpty(etlPart)` juggling in
  `activeParentConfig` and its near-duplicate inside `originalGrapherConfig`
  (`AbstractChartEditor.ts:199`)
- the two stale merges above: both become
  `updateLiveGrapher(merge(this.parentConfig ?? {}, patchConfig))`
- the `activeParentConfig` / `parentConfig` distinction — with layers as the
  input, "the parent config" is unambiguously the active merged one, and only
  the debug tab needs the individual layers (which it should show as separate,
  correctly labelled sections anyway)

Adding a fifth layer later (or a per-layer active flag) then means touching
`parentLayers`, not every consumer.

## Open question: should `isInheritanceEnabled` cover the ETL layer too?

Today it does not. The flag gates only the indicator layer:
`newParentStack = merge(parent?.config ?? {}, etlConfig)` keeps `etlConfig`
regardless (`charts.ts:474`, `charts.ts:1244`), and the indicator-change fan-out
selects `WHERE c.isInheritanceEnabled IS TRUE` (`db/model/Variable.ts:258`) —
i.e. the flag means "does this chart follow its indicator".

**Pros of extending it**

- One invariant to hold in your head:
  `full = isInheritanceEnabled ? merge(stack, patch) : patch`, and one toggle in
  the UI instead of two mechanisms to explain.
- The bug class above becomes unrepresentable: with a single flag over a single
  merged parent, `shouldBeEnabled ? parentConfig : undefined` is correct by
  construction.
- Gives an admin a one-click freeze after a bad ETL push, without needing the ETL
  side or a detach button.

**Cons**

- **Silent no-op ETL pushes.** `PUT /charts/.../etlConfig` would keep succeeding
  and keep writing the `chart_configs` row while nothing changes on the site.
  Safe only if the endpoint also warns or 409s, which re-introduces two concepts
  by the back door.
- **It conflates two decisions with different owners.** "Don't follow the
  indicator" (admin's call) and "don't follow the ETL's chart config" (a
  data-manager/admin negotiation) become inexpressible separately. A bespoke
  hand-tuned chart that ignores the indicator's defaults but still tracks ETL
  dimension updates would be impossible.
- **`dimensions` live in the ETL layer.** For an ETL-authored chart the admin
  patch typically has no `dimensions` at all — #6826 relies on this
  (`charts.ts:445-470`), and the bootstrap path puts only `slug` in the patch.
  Flipping the flag off would leave such a chart with no dimensions: broken, not
  frozen. Making it safe means folding the ETL layer into the patch at toggle
  time — which is exactly what `DELETE /charts/:chartId/etlConfig` already does
  (`charts.ts:1441-1470`), so the flag becomes a confusing alias for detach.
- **Asymmetric restore.** Toggling the indicator layer off and on again is
  lossless today, because the layer is re-resolvable from the chart's dimensions.
  If "off" had to fold ETL values into the patch, "on" would not be lossless: the
  patch now pins former ETL values and shadows all future ETL pushes.
- **It changes the meaning of existing rows, in the awkward direction.** In the
  local dev snapshot 4540 of 5194 charts have `isInheritanceEnabled = 0` (mostly
  legacy charts; new charts default to on). Under an extended flag, an ETL push
  that adopts one of those charts would need the flag flipped to `1` for its
  layer to apply at all — and that same flip would switch on indicator
  inheritance for a chart whose hand-authored patch was never diffed against the
  indicator config, changing how it renders. "ETL takes over an existing chart"
  should not require a semantically unrelated, config-changing flag flip.

**Recommendation: keep the flag scoped to the indicator layer.** The ETL layer
already has an explicit, non-boolean lifecycle — attach with `PUT`, detach with
`DELETE` (which folds its contributions into the patch). That is strictly better
than a flag, because it leaves no dangling layer that the ETL keeps writing to
and nobody applies.

Cheap follow-ups that address the ambiguity that prompted the question:

- Label the toggle "Inherit from indicator" in the UI, and consider
  `isIndicatorInheritanceEnabled` for the editor-side field. Renaming the DB
  column is probably not worth a migration on its own.
- Give the debug tab a separate read-only "ETL config" section, so it's visible
  which fields the admin cannot edit and why.
- If an in-admin freeze button is wanted, wire it to the `DELETE` route and label
  it "Stop ETL management of this chart".
- If per-layer opt-out ever becomes a real requirement, model it per layer
  (`layers: [{ source, active }]`) rather than adding a second boolean.
