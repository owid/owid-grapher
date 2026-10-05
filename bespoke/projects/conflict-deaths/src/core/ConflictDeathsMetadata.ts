import * as R from "remeda"
import {
    ConflictTypeMetadata,
    EntityMetadata,
    MetadataJson,
    RegionMetadata,
} from "./ConflictDeathsConstants.js"

export class ConflictDeathsMetadata {
    source: MetadataJson["source"]
    timeRange: MetadataJson["timeRange"]
    regions: RegionMetadata[]
    conflictTypes: ConflictTypeMetadata[]

    private readonly entities: EntityMetadata[]

    private _entityById?: Map<number, EntityMetadata>
    private _regionById?: Map<number, RegionMetadata>
    private _conflictTypeBySlug?: Map<string, ConflictTypeMetadata>
    private _availableYears?: number[]

    constructor(metadata: MetadataJson) {
        this.source = metadata.source
        this.timeRange = metadata.timeRange
        this.regions = metadata.regions
        this.conflictTypes = metadata.conflictTypes
        this.entities = metadata.entities
    }

    get entityById(): Map<number, EntityMetadata> {
        if (this._entityById) return this._entityById

        this._entityById = new Map(
            this.entities.map((entity) => [entity.id, entity])
        )

        return this._entityById
    }

    get regionById(): Map<number, RegionMetadata> {
        if (this._regionById) return this._regionById

        this._regionById = new Map(
            this.regions.map((region) => [region.id, region])
        )

        return this._regionById
    }

    get conflictTypeBySlug(): Map<string, ConflictTypeMetadata> {
        if (this._conflictTypeBySlug) return this._conflictTypeBySlug

        this._conflictTypeBySlug = new Map(
            this.conflictTypes.map((type) => [type.slug, type])
        )

        return this._conflictTypeBySlug
    }

    get availableYears(): number[] {
        if (this._availableYears) return this._availableYears

        this._availableYears = R.range(
            this.timeRange.start,
            this.timeRange.end + 1
        )

        return this._availableYears
    }
}
