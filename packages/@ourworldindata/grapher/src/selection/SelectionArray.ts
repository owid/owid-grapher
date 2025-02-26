import { EntityCode, EntityId, EntityName } from "@ourworldindata/types"
import { difference } from "@ourworldindata/utils"
import { action, computed, observable } from "mobx"

export interface Entity {
    entityName: EntityName
    entityId?: EntityId
    entityCode?: EntityCode
}

export class SelectionArray {
    constructor(
        selectedEntityNames: EntityName[] = [],
        availableEntities: Entity[] = []
    ) {
        this.selectedEntityNames = selectedEntityNames.slice()
        this.availableEntities = availableEntities.slice()
    }

    @observable selectedEntityNames: EntityName[]
    @observable private availableEntities: Entity[]

    @computed get availableEntityNames(): string[] {
        return this.availableEntities.map((entity) => entity.entityName)
    }

    @computed get availableEntityNameSet(): Set<string> {
        return new Set(this.availableEntityNames)
    }

    @computed get hasSelection(): boolean {
        return this.selectedEntityNames.length > 0
    }

    @computed get unselectedEntityNames(): string[] {
        return difference(this.availableEntityNames, this.selectedEntityNames)
    }

    @computed get numSelectedEntities(): number {
        return this.selectedEntityNames.length
    }

    @computed get selectedSet(): Set<EntityName> {
        return new Set<EntityName>(this.selectedEntityNames)
    }

    // Clears and sets selected entities
    @action.bound setSelectedEntities(entityNames: EntityName[]): this {
        this.clearSelection()
        return this.addToSelection(entityNames)
    }

    @action.bound addToSelection(entityNames: EntityName[]): this {
        this.selectedEntityNames = this.selectedEntityNames.concat(entityNames)
        return this
    }

    @action.bound addAvailableEntityNames(entities: Entity[]): this {
        this.availableEntities.push(...entities)
        return this
    }

    @action.bound setAvailableEntities(entities: Entity[]): this {
        this.availableEntities = entities
        return this
    }

    @action.bound selectAll(): this {
        return this.addToSelection(this.unselectedEntityNames)
    }

    @action.bound clearSelection(): void {
        this.selectedEntityNames = []
    }

    @action.bound toggleSelection(entityName: EntityName): this {
        return this.selectedSet.has(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
    }

    @computed get numAvailableEntityNames(): number {
        return this.availableEntityNames.length
    }

    @action.bound selectEntity(entityName: EntityName): this {
        if (!this.selectedSet.has(entityName))
            return this.addToSelection([entityName])
        return this
    }

    @action.bound deselectEntity(entityName: EntityName): this {
        this.selectedEntityNames = this.selectedEntityNames.filter(
            (name) => name !== entityName
        )
        return this
    }

    @action.bound selectEntities(entityNames: EntityName[]): this {
        entityNames.forEach((entityName) => this.selectEntity(entityName))
        return this
    }

    @action.bound deselectEntities(entityNames: EntityName[]): this {
        this.selectedEntityNames = this.selectedEntityNames.filter(
            (name) => !entityNames.includes(name)
        )
        return this
    }

    // Mainly for testing
    @action.bound selectSample(howMany = 1): this {
        return this.setSelectedEntities(
            this.availableEntityNames.slice(0, howMany)
        )
    }
}
