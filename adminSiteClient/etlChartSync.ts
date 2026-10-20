import * as _ from "lodash-es"
import { GrapherInterface } from "@ourworldindata/types"
import { KEYS_EXCLUDED_FROM_INHERITANCE } from "@ourworldindata/utils"
import type { ChartListItem } from "./ChartList.js"

/**
 * How an ETL-managed chart has drifted from its ETL config: everything the
 * admin changed on top of what the ETL pushed. A chart with no drift renders
 * exactly what its ETL config (plus its indicator's config) describes.
 */
export interface EtlDrift {
    /** Top-level config fields the admin patch overrides */
    overriddenFields: string[]
    /** Set if the admin renamed the chart away from the slug ETL proposes */
    slugOverride?: { slug: string; etlSlug: string }
}

export interface EtlSource {
    catalogPath: string | null
    drift: EtlDrift
}

export function makeEtlDrift({
    overriddenFields,
    slug,
    etlSlug,
}: {
    overriddenFields: string[]
    slug: string | undefined
    etlSlug: string | null | undefined
}): EtlDrift {
    const slugOverride =
        slug && etlSlug && slug !== etlSlug ? { slug, etlSlug } : undefined
    return { overriddenFields, slugOverride }
}

export function getChartListItemEtlSource(
    chart: ChartListItem
): EtlSource | undefined {
    if (!chart.isEtlManaged) return undefined
    return {
        catalogPath: chart.etlConfigCatalogPath,
        drift: makeEtlDrift({
            overriddenFields: JSON.parse(chart.etlOverriddenFields ?? "[]"),
            slug: chart.slug,
            etlSlug: chart.etlSlug,
        }),
    }
}

/** Top-level fields an admin patch overrides, i.e. all but its identity keys */
export function getOverriddenFields(patchConfig: GrapherInterface): string[] {
    return Object.keys(_.omit(patchConfig, KEYS_EXCLUDED_FROM_INHERITANCE))
}

export function hasEtlDrift(drift: EtlDrift): boolean {
    return drift.overriddenFields.length > 0 || drift.slugOverride !== undefined
}

export function describeEtlDrift(drift: EtlDrift): string[] {
    const descriptions: string[] = []
    if (drift.overriddenFields.length > 0)
        descriptions.push(
            `Fields overridden in the admin: ${drift.overriddenFields.join(", ")}`
        )
    if (drift.slugOverride)
        descriptions.push(
            `Slug "${drift.slugOverride.slug}" differs from the one ETL proposes ("${drift.slugOverride.etlSlug}")`
        )
    return descriptions
}

/**
 * Link to the YAML file a chart's ETL config is authored in, e.g.
 * "oecd/latest/climate_aid#climate_aid" →
 * etl/steps/viz/chart/oecd/latest/climate_aid.config.yml
 */
export function makeEtlConfigGitHubUrl(
    catalogPath: string | null | undefined
): string | undefined {
    // The step is the last three segments: namespace/version/short_name
    const stepPathSegments = catalogPath?.split("#")[0].split("/") ?? []
    if (stepPathSegments.length < 3) return undefined
    const stepPath = stepPathSegments.slice(-3).join("/")
    return `https://github.com/owid/etl/blob/master/etl/steps/viz/chart/${stepPath}.config.yml`
}
