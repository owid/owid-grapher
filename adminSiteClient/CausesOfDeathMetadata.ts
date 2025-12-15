import * as R from "remeda"
import { EntityName } from "@ourworldindata/types"
import {
    AgeGroupMetadata,
    CategoryMetadata,
    MetadataJson,
    EntityMetadata,
    VariableMetadata,
    BasicEntry,
} from "./CausesOfDeathConstants.js"

export class CausesOfDeathMetadata {
    private metadata: MetadataJson

    dimensions: MetadataJson["dimensions"]
    categories: MetadataJson["categories"]
    source: MetadataJson["source"]
    timeRange: MetadataJson["timeRange"]

    private _entityNameToId?: Map<EntityName, number>
    private _variableById?: Map<number, VariableMetadata>
    private _variableByName?: Map<string, VariableMetadata>
    private _categoryById?: Map<number, CategoryMetadata>
    private _categoryNameByVariableName?: Map<string, string>

    constructor(metadata: MetadataJson) {
        this.metadata = metadata

        this.dimensions = metadata.dimensions
        this.categories = metadata.categories
        this.source = metadata.source
        this.timeRange = metadata.timeRange
    }

    get entityNameToId(): Map<EntityName, number> {
        if (this._entityNameToId) return this._entityNameToId

        this._entityNameToId = new Map(
            this.metadata.dimensions.entities.map((entity) => [
                entity.name,
                entity.id,
            ])
        )

        return this._entityNameToId
    }

    get variableById(): Map<number, VariableMetadata> {
        if (this._variableById) return this._variableById

        this._variableById = new Map(
            this.metadata.dimensions.variables.map((variable) => [
                variable.id,
                variable,
            ])
        )

        return this._variableById
    }

    get variableByName(): Map<string, VariableMetadata> {
        if (this._variableByName) return this._variableByName

        this._variableByName = new Map(
            this.metadata.dimensions.variables.map((variable) => [
                variable.name,
                variable,
            ])
        )

        return this._variableByName
    }

    get ageGroupById(): Map<number, AgeGroupMetadata> {
        return new Map(
            this.dimensions.ageGroups.map((ageGroup) => [ageGroup.id, ageGroup])
        )
    }

    get ageGroupByName(): Map<string, AgeGroupMetadata> {
        return new Map(
            this.dimensions.ageGroups.map((ageGroup) => [
                ageGroup.name,
                ageGroup,
            ])
        )
    }

    get categoryById(): Map<number, CategoryMetadata> {
        if (this._categoryById) return this._categoryById

        this._categoryById = new Map(
            this.metadata.categories.map((category) => [category.id, category])
        )

        return this._categoryById
    }

    get availableEntities(): EntityMetadata[] {
        return R.pipe(
            this.metadata.dimensions.entities,
            R.sortBy((entity) => entity.name)
        )
    }

    get categoryNameByVariableName(): Map<string, string> {
        if (this._categoryNameByVariableName)
            return this._categoryNameByVariableName

        this._categoryNameByVariableName = new Map(
            this.dimensions.variables.map((variable) => [
                variable.name,
                this.categoryById.get(variable.category)!.name, // TODO: !
            ])
        )

        return this._categoryNameByVariableName
    }

    variablesForAgeGroup(ageGroupName: string): VariableMetadata[] {
        return this.dimensions.variables.filter((variable) =>
            variable.ageGroup.some(
                (ageGroupId) =>
                    this.ageGroupById.get(ageGroupId)?.name === ageGroupName
            )
        )
    }

    categoriesForAgeGroup(ageGroupName: string): CategoryMetadata[] {
        const categoryIds = R.unique(
            this.variablesForAgeGroup(ageGroupName).map((v) => v.category)
        )

        return categoryIds
            .map((c) => this.categoryById.get(c))
            .filter((c) => c !== undefined)
    }

    get availableYears(): number[] {
        return R.range(this.timeRange.start, this.timeRange.end + 1)
    }

    get availableAgeGroups(): string[] {
        return this.dimensions.ageGroups.map((ageGroup) => ageGroup.name)
    }

    get sexById(): Map<number, BasicEntry> {
        return new Map(this.dimensions.sexes.map((sex) => [sex.id, sex]))
    }

    get sexByName(): Map<string, BasicEntry> {
        return new Map(this.dimensions.sexes.map((sex) => [sex.name, sex]))
    }

    get availableSexes(): string[] {
        return this.dimensions.sexes.map((sex) => sex.name)
    }
}
