import { EntityName } from "@ourworldindata/types"
import { action, computed, observable, makeObservable } from "mobx"

export class SelectionArray {
    constructor(selectedEntityNames: EntityName[] = []) {
        makeObservable(this)
        this.selectedEntityNames = selectedEntityNames.slice()
    }

    @observable selectedEntityNames: EntityName[]

    @computed get hasSelection(): boolean {
        return this.selectedEntityNames.length > 0
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

    @action.bound clearSelection(): void {
        this.selectedEntityNames = []
    }

    @action.bound toggleSelection(entityName: EntityName): this {
        return this.selectedSet.has(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
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
}
