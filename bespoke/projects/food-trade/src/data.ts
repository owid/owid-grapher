import { QueryStatus, useQuery } from "@tanstack/react-query"

import { fetchJson } from "@ourworldindata/utils"

import {
    FoodTradeMetadata,
    MetadataJson,
    ProductJson,
    ProductTradeData,
    TradeRow,
} from "./types.js"

const BASE_URL = "https://owid-public.owid.io/data/food-trade"
const METADATA_PATH = `${BASE_URL}/food-trade.metadata.json`
const PRODUCT_DATA_PATH = (productId: number) =>
    `${BASE_URL}/food-trade.${productId}.json`

const queryKeys = {
    metadata: () => ["food-trade", "metadata"] as const,
    product: (productId: number) =>
        ["food-trade", "product", productId] as const,
}

export const useFoodTradeMetadata = (): {
    data?: FoodTradeMetadata
    status: QueryStatus
} => {
    const result = useQuery({
        queryKey: queryKeys.metadata(),
        queryFn: () => fetchJson<MetadataJson>(METADATA_PATH),
        staleTime: Infinity, // Never refetch
    })

    const data = result.data ? buildMetadata(result.data) : undefined
    return { data, status: result.status }
}

export const useProductTradeData = (
    productId: number | undefined,
    metadata: FoodTradeMetadata | undefined
): {
    data?: ProductTradeData
    status: QueryStatus
    isFetching: boolean
} => {
    const result = useQuery({
        queryKey: queryKeys.product(productId!),
        queryFn: () => fetchJson<ProductJson>(PRODUCT_DATA_PATH(productId!)),
        enabled: productId !== undefined && metadata !== undefined,
        staleTime: Infinity, // Never refetch
        // Keep the previous product on screen while a new one loads,
        // so product switches don't flash the skeleton.
        placeholderData: (previousData) => previousData,
    })

    const data =
        metadata && result.data && productId !== undefined
            ? buildData(result.data, productId, metadata)
            : undefined

    return {
        data,
        status: result.status,
        isFetching: result.isFetching,
    }
}

function buildMetadata(raw: MetadataJson): FoodTradeMetadata {
    const entities = raw.dimensions.entities
    const products = raw.dimensions.products
    const entityByName = new Map(entities.map((e) => [e.name, e]))
    const productByName = new Map(products.map((p) => [p.name, p]))
    const productsByEntity = new Map<number, Set<number>>(
        Object.entries(raw.productsByEntity).map(([entityId, productIds]) => [
            Number(entityId),
            new Set(productIds),
        ])
    )
    const hasTradeData = (entityName: string, productName: string): boolean => {
        const entityId = entityByName.get(entityName)?.id
        const productId = productByName.get(productName)?.id
        if (entityId === undefined || productId === undefined) return true
        return productsByEntity.get(entityId)?.has(productId) ?? true
    }

    return {
        year: raw.year,
        source: raw.source,
        license: raw.license,
        entities,
        products,
        entityById: new Map(entities.map((e) => [e.id, e])),
        productById: new Map(products.map((p) => [p.id, p])),
        productByName,
        hasTradeData,
    }
}

function buildData(
    raw: ProductJson,
    productId: number,
    metadata: FoodTradeMetadata
): ProductTradeData {
    const product = metadata.productById.get(productId)?.name ?? ""

    const flows: TradeRow[] = []
    const incomingFlowsByCountry = new Map<string, TradeRow[]>()
    const outgoingFlowsByCountry = new Map<string, TradeRow[]>()
    for (let i = 0; i < raw.flows.values.length; i++) {
        const exporter = metadata.entityById.get(raw.flows.exporters[i])?.name
        const importer = metadata.entityById.get(raw.flows.importers[i])?.name
        if (!exporter || !importer) continue
        const value = raw.flows.values[i]
        const row: TradeRow = { exporter, importer, product, value }
        flows.push(row)
        const importerBucket = incomingFlowsByCountry.get(importer)
        if (importerBucket) importerBucket.push(row)
        else incomingFlowsByCountry.set(importer, [row])
        const exporterBucket = outgoingFlowsByCountry.get(exporter)
        if (exporterBucket) exporterBucket.push(row)
        else outgoingFlowsByCountry.set(exporter, [row])
    }

    return {
        flows,
        productionByCountry: indexByEntityName(raw.production, metadata),
        supplyByCountry: indexByEntityName(raw.supply, metadata),
        incomingFlowsByCountry,
        outgoingFlowsByCountry,
    }
}

function indexByEntityName(
    series: { entities: number[]; values: number[] },
    metadata: FoodTradeMetadata
): Map<string, number> {
    const out = new Map<string, number>()
    for (let i = 0; i < series.values.length; i++) {
        const name = metadata.entityById.get(series.entities[i])?.name
        if (name) out.set(name, series.values[i])
    }
    return out
}
