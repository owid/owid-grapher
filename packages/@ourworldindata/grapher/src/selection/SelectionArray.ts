import { EntityName } from "@ourworldindata/types"
import { action, computed, makeObservable, observable } from "mobx"

export class SelectionArray {
    private store: Set<EntityName> = new Set()

    constructor(selectedEntityNames: EntityName[] = []) {
        makeObservable<SelectionArray, "store">(this, { store: observable })

        for (const name of selectedEntityNames) {
            this.store.add(name)
        }
    }

    @computed get selectedEntityNames(): EntityName[] {
        return [...this.store]
    }

    @computed get hasSelection(): boolean {
        return this.numSelectedEntities > 0
    }

    @computed get isEmpty(): boolean {
        return this.store.size === 0
    }

    has(entityName: EntityName): boolean {
        return this.store.has(entityName)
    }

    @computed get numSelectedEntities(): number {
        return this.store.size
    }

    @computed get selectedSet(): Set<EntityName> {
        return new Set(this.store)
    }

    // Clears and sets selected entities
    @action.bound setSelectedEntities(entityNames: EntityName[]): this {
        this.clearSelection()
        return this.addToSelection(entityNames)
    }

    @action.bound addToSelection(entityNames: EntityName[]): this {
        for (const name of entityNames) this.selectEntity(name)
        return this
    }

    @action.bound clearSelection(): void {
        this.store.clear()
    }

    @action.bound toggleSelection(entityName: EntityName): this {
        return this.store.has(entityName)
            ? this.deselectEntity(entityName)
            : this.selectEntity(entityName)
    }

    @action.bound selectEntity(entityName: EntityName): this {
        this.store.add(entityName)
        return this
    }

    @action.bound deselectEntity(entityName: EntityName): this {
        this.store.delete(entityName)
        return this
    }

    @action.bound selectEntities(entityNames: EntityName[]): this {
        for (const name of entityNames) this.selectEntity(name)
        return this
    }

    @action.bound deselectEntities(entityNames: EntityName[]): this {
        for (const name of entityNames) this.deselectEntity(name)
        return this
    }
}
