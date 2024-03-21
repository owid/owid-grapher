import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faPencilAlt,
    faEye,
    faRightLeft,
} from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"

export interface EntitySelectionManager {
    canHighlightEntities?: boolean
    canChangeEntity?: boolean
    canAddEntities?: boolean
    entityType?: string
    entityTypePlural?: string
    isEntitySelectorModalOrDrawerOpen?: boolean
    isOnChartTab?: boolean
}

interface EntitySelectionLabel {
    icon: JSX.Element
    action: string
    entity: string
}

@observer
export class EntitySelectionToggle extends React.Component<{
    manager: EntitySelectionManager
}> {
    static shouldShow(manager: EntitySelectionManager): boolean {
        const toggle = new EntitySelectionToggle({ manager })
        return toggle.showToggle
    }

    @computed get showToggle(): boolean {
        const { isOnChartTab } = this.props.manager
        return !!(isOnChartTab && this.label)
    }

    @computed get label(): EntitySelectionLabel | null {
        const {
            entityType = "",
            entityTypePlural = "",
            canHighlightEntities,
            canChangeEntity,
            canAddEntities,
        } = this.props.manager

        return canHighlightEntities
            ? {
                  action: "Select",
                  entity: entityTypePlural,
                  icon: <FontAwesomeIcon icon={faEye} />,
              }
            : canChangeEntity
            ? {
                  action: "Change",
                  entity: entityType,
                  icon: <FontAwesomeIcon icon={faRightLeft} />,
              }
            : canAddEntities
            ? {
                  action: "Edit",
                  entity: entityTypePlural,
                  icon: <FontAwesomeIcon icon={faPencilAlt} />,
              }
            : null
    }

    render(): JSX.Element | null {
        const { showToggle, label } = this
        const { isEntitySelectorModalOrDrawerOpen: active } = this.props.manager

        return showToggle && label ? (
            <div className="entity-selection-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={(e): void => {
                        this.props.manager.isEntitySelectorModalOrDrawerOpen =
                            !active
                        e.stopPropagation()
                    }}
                    type="button"
                    data-track-note="chart_add_entity"
                    aria-label={`${label.action} ${label.entity}`}
                >
                    {label.icon}
                    <label>
                        {label.action} <span>{label.entity}</span>
                    </label>
                </button>
            </div>
        ) : null
    }
}
