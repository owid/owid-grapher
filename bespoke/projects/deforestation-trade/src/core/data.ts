import { QueryStatus, useQuery } from "@tanstack/react-query"

import { fetchJson, getRegionByCode } from "@ourworldindata/utils"

import { parseBespokeMetadata } from "../../../../components/MetadataModal/bespokeMetadata.js"

import {
    CountryData,
    DeforestationMetadata,
    Entity,
    RawCountryJson,
    RawFlowBlock,
    RawMetadataJson,
    TradeSeries,
} from "./types.js"

const queryKeys = {
    metadata: () => ["deforestation-trade", "metadata"] as const,
    country: (entityId: number) =>
        ["deforestation-trade", "country", entityId] as const,
}

export const useDeforestationMetadata = (
    metadataUrl: string
): {
    data?: DeforestationMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () => fetchJson<RawMetadataJson>(metadataUrl),
        staleTime: Infinity, // Never refetch
    })

    const data = result.data ? buildMetadata(result.data) : undefined
    return { data, status: result.status }
}

export const useCountryData = (
    entityId: number | undefined,
    metadata: DeforestationMetadata | undefined,
    dataUrl: string
): {
    data?: CountryData
    status: QueryStatus
    isPlaceholderData: boolean
} => {
    const url = `${dataUrl}/deforestation-trade.${entityId}.json`
    const result = useQuery({
        queryKey: queryKeys.country(entityId ?? -1),
        queryFn: async () => {
            if (entityId === undefined) throw new Error("Missing country ID")
            return {
                entityId,
                flows: await fetchJson<RawCountryJson>(url),
            }
        },
        enabled: entityId !== undefined && metadata !== undefined,
        staleTime: Infinity, // Never refetch
        // Keep the previous country on screen while a new one loads,
        // so country switches don't flash the skeleton.
        placeholderData: (previousData) => previousData,
    })

    const data =
        metadata && result.data
            ? {
                  country:
                      metadata.entityById.get(result.data.entityId)?.name ?? "",
                  imports: decodeFlowBlock(result.data.flows.imports, metadata),
                  exports: decodeFlowBlock(result.data.flows.exports, metadata),
              }
            : undefined

    return {
        data,
        status: result.status,
        // True while a previously-loaded country stays on screen as a new
        // country file is being fetched — used to dim the chart and show a
        // spinner. False on the initial load (the skeleton covers that).
        isPlaceholderData: result.isPlaceholderData,
    }
}

function buildMetadata(raw: RawMetadataJson): DeforestationMetadata {
    const { commodityGroups } = raw.dimensions
    const entities = raw.dimensions.entities.map(canonicalizeEntityName)
    const groupNameById = new Map(commodityGroups.map((g) => [g.id, g.name]))
    const worldTotals = (raw.worldTotals ?? []).flatMap((t) => {
        const group = groupNameById.get(t.commodityGroup)
        return group === undefined ? [] : [{ group, values: t.values }]
    })

    return {
        years: raw.years,
        source: raw.source,
        entities,
        commodityGroups,
        entityById: new Map(entities.map((e) => [e.id, e])),
        entityByName: new Map(entities.map((e) => [e.name, e])),
        worldTotals,
        bespoke: parseBespokeMetadata(raw),
    }
}

/**
 * The source spells some countries its own way ("Democratic Republic of the
 * Congo"); OWID's regions know them by ISO code, so use OWID's name. That is
 * what the short-label and article helpers key on, and what readers see in
 * the dropdown and the URL. Composite entities (e.g. "SRB and MNE") have no
 * ISO code and keep their name.
 */
function canonicalizeEntityName(entity: Entity): Entity {
    const name = getRegionByCode(entity.iso)?.name
    return name && name !== entity.name ? { ...entity, name } : entity
}

const UNKNOWN_NAME = "Unknown"

/** An id the manifest doesn't list is a broken data file, not something the
 *  reader can act on — warn once and let the flow render as "Unknown" rather
 *  than dropping it and quietly changing the totals. */
let hasWarnedAboutUnknownIds = false
function warnAboutUnknownIds(): void {
    if (hasWarnedAboutUnknownIds) return
    hasWarnedAboutUnknownIds = true
    console.warn(
        'deforestation-trade: a data file references entity or commodity-group ids that the metadata manifest does not list; those flows render as "Unknown"'
    )
}

function decodeFlowBlock(
    block: RawFlowBlock,
    metadata: DeforestationMetadata
): TradeSeries[] {
    const groupNameById = new Map(
        metadata.commodityGroups.map((g) => [g.id, g.name])
    )

    const out: TradeSeries[] = new Array(block.partners.length)
    for (let i = 0; i < block.partners.length; i++) {
        const partner = metadata.entityById.get(block.partners[i])?.name
        const group = groupNameById.get(block.groups[i])
        if (partner === undefined || group === undefined) warnAboutUnknownIds()
        out[i] = {
            partner: partner ?? UNKNOWN_NAME,
            group: group ?? UNKNOWN_NAME,
            values: block.values[i],
        }
    }
    return out
}
