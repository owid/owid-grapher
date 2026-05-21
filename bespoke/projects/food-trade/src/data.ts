import { QueryStatus, useQuery } from "@tanstack/react-query"

import { fetchJson } from "@ourworldindata/utils"

// TODO: drop ?nocache

const BASE_URL = "https://owid-public.owid.io/data/food-trade"
const METADATA_PATH = `${BASE_URL}/food-trade.metadata.json`
const PRODUCT_DATA_PATH = (productId: number) =>
    `${BASE_URL}/food-trade.${productId}.json`

export type TradeRow = {
    exporter: string
    importer: string
    item: string
    value: number
}

export type ProductTradeData = {
    flows: TradeRow[]
    production: Map<string, number>
    supply: Map<string, number>
}

type EntityRef = { id: number; name: string }
type ProductRef = { id: number; name: string }

type MetadataJson = {
    year: number
    source: string
    license: string
    dimensions: {
        entities: EntityRef[]
        products: ProductRef[]
    }
    /** Entity ID → product IDs the entity has at least one trade flow for.
     *  Object keys are stringified entity IDs (JSON has no number keys). */
    productsByEntity: Record<string, number[]>
}

export type FoodTradeMetadata = {
    year: number
    source: string
    license: string
    entities: EntityRef[]
    products: ProductRef[]
    entityById: Map<number, EntityRef>
    entityByName: Map<string, EntityRef>
    productById: Map<number, ProductRef>
    productByName: Map<string, ProductRef>
    /** Product IDs each entity trades. Keyed by entity ID. */
    productsByEntity: Map<number, Set<number>>
    /** True if the entity has at least one trade flow (import or export)
     *  involving this product. Defaults to true for unknown
     *  entity/product names so dropdown grouping doesn't gray out
     *  options on lookup misses. */
    tradesProduct: (entityName: string, productName: string) => boolean
}

type ProductJson = {
    flows: { exporters: number[]; importers: number[]; values: number[] }
    production: { entities: number[]; values: number[] }
    supply: { entities: number[]; values: number[] }
}

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
        queryFn: () => fetchJson<MetadataJson>(METADATA_PATH + "?nocache"),
        staleTime: Infinity,
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
        queryFn: () =>
            fetchJson<ProductJson>(PRODUCT_DATA_PATH(productId!) + "?nocache"),
        enabled: productId !== undefined && metadata !== undefined,
        staleTime: Infinity,
        // Keep the previous product on screen while a new one loads,
        // so product switches don't flash the skeleton.
        placeholderData: (previousData) => previousData,
    })

    const data =
        metadata && result.data && productId !== undefined
            ? hydrateProduct(result.data, productId, metadata)
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
    const tradesProduct = (
        entityName: string,
        productName: string
    ): boolean => {
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
        entityByName,
        productById: new Map(products.map((p) => [p.id, p])),
        productByName,
        productsByEntity,
        tradesProduct,
    }
}

function hydrateProduct(
    raw: ProductJson,
    productId: number,
    metadata: FoodTradeMetadata
): ProductTradeData {
    const item = metadata.productById.get(productId)?.name ?? ""
    const flows: TradeRow[] = []
    for (let i = 0; i < raw.flows.values.length; i++) {
        const exporter = metadata.entityById.get(raw.flows.exporters[i])?.name
        const importer = metadata.entityById.get(raw.flows.importers[i])?.name
        if (!exporter || !importer) continue
        flows.push({
            exporter,
            importer,
            item,
            value: raw.flows.values[i],
        })
    }
    return {
        flows,
        production: indexByEntityName(raw.production, metadata),
        supply: indexByEntityName(raw.supply, metadata),
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
