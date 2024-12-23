import * as React from "react"
import { observer } from "mobx-react"
import { computed, action } from "mobx"
import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { Modal } from "./Modal"
import {
    EntitySelector,
    EntitySelectorManager,
} from "../entitySelector/EntitySelector"

export interface EntitySelectorModalManager extends EntitySelectorManager {
    isEntitySelectorModalOrDrawerOpen?: boolean
    frameBounds?: Bounds
}

@observer
export class EntitySelectorModal extends React.Component<{
    manager: EntitySelectorModalManager
}> {
    @computed private get manager(): EntitySelectorModalManager {
        return this.props.manager
    }

    @computed private get frameBounds(): Bounds {
        return this.manager.frameBounds ?? DEFAULT_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = 366
        const padWidth = Math.max(16, (this.frameBounds.width - maxWidth) / 2)
        return this.frameBounds.padHeight(16).padWidth(padWidth)
    }

    @action.bound onDismiss(): void {
        this.manager.isEntitySelectorModalOrDrawerOpen = false
    }

    render(): React.ReactElement {
        return (
            <Modal
                onDismiss={this.onDismiss}
                bounds={this.modalBounds}
                isHeightFixed={true}
            >
                <EntitySelector
                    manager={this.manager}
                    onDismiss={this.onDismiss}
                    autoFocus={true}
                />
            </Modal>
        )
    }
}
