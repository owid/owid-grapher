import { EntityName } from "@ourworldindata/types"
import { action, computed, observable } from "mobx"

export class InteractionArray {
    constructor(focusedEntityNames: EntityName[] = []) {
        this.focusedEntityNames = focusedEntityNames.slice()
    }

    @observable focusedEntityNames: EntityName[]

    @computed get focusedEntityNameSet(): Set<EntityName> {
        return new Set<EntityName>(this.focusedEntityNames)
    }

    @action.bound focusEntity(entityName: EntityName): this {
        if (!this.focusedEntityNameSet.has(entityName))
            this.focusedEntityNames.push(entityName)
        return this
    }

    @action.bound unfocusEntity(entityName: EntityName): this {
        this.focusedEntityNames = this.focusedEntityNames.filter(
            (name) => name !== entityName
        )
        return this
    }

    @action.bound toggleFocus(entityName: EntityName): this {
        return this.focusedEntityNameSet.has(entityName)
            ? this.unfocusEntity(entityName)
            : this.focusEntity(entityName)
    }

    @action.bound clear(): void {
        this.focusedEntityNames = []
    }

    @action.bound addToFocusedEntities(entityNames: EntityName[]): this {
        this.focusedEntityNames = this.focusedEntityNames.concat(entityNames)
        return this
    }

    // Clears and sets focused entities
    @action.bound setFocusedEntities(entityNames: EntityName[]): this {
        this.clear()
        return this.addToFocusedEntities(entityNames)
    }
}
