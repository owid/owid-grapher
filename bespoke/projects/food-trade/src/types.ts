export type VariantName = "sankey"

export type TradeRow = {
    exporter: string
    importer: string
    product: string
    value: number
}

export type ProductTradeData = {
    flows: TradeRow[]
    productionByCountry: Map<string, number>
    supplyByCountry: Map<string, number>
    incomingFlowsByCountry: Map<string, TradeRow[]>
    outgoingFlowsByCountry: Map<string, TradeRow[]>
}

export type Entity = { id: number; name: string }
export type Product = { id: number; name: string }

export type MetadataJson = {
    year: number
    source: string
    license: string
    dimensions: {
        entities: Entity[]
        products: Product[]
    }
    // Entity ID → product IDs the entity has at least one trade flow for
    productsByEntity: Record<string, number[]>
}

export type ProductJson = {
    flows: { exporters: number[]; importers: number[]; values: number[] }
    production: { entities: number[]; values: number[] }
    supply: { entities: number[]; values: number[] }
}

export type FoodTradeMetadata = {
    year: number
    source: string
    license: string
    entities: Entity[]
    products: Product[]
    entityById: Map<number, Entity>
    productById: Map<number, Product>
    productByName: Map<string, Product>
    hasTradeData: (entityName: string, productName: string) => boolean
}
