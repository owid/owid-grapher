import * as R from "remeda"
import { EntityName } from "@ourworldindata/types"
import {
    CategoryMetadata,
    CausesOfDeathMetadata,
    EntityMetadata,
    VariableMetadata,
} from "./CausesOfDeathConstants.js"

export class MyCausesOfDeathMetadata {
    private metadata: CausesOfDeathMetadata

    dimensions: CausesOfDeathMetadata["dimensions"]
    categories: CausesOfDeathMetadata["categories"]

    private _entityNameToId?: Map<EntityName, number>
    private _variableById?: Map<number, VariableMetadata>
    private _variableByName?: Map<string, VariableMetadata>
    private _categoryById?: Map<number, CategoryMetadata>
    private _categoryNameByVariableName?: Map<string, string>

    constructor(metadata: CausesOfDeathMetadata) {
        this.metadata = metadata

        this.dimensions = metadata.dimensions
        this.categories = metadata.categories
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

        console.log(this._categoryNameByVariableName)

        return this._categoryNameByVariableName
    }
}
