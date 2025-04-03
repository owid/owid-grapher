import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEye, faRightLeft, faPen } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"
import { MAP_GRAPHER_ENTITY_TYPE_PLURAL } from "../core/GrapherConstants.js"

export interface EntitySelectionManager {
    canHighlightEntities?: boolean
    canChangeEntity?: boolean
    canAddEntities?: boolean
    entityType?: string
    entityTypePlural?: string
    isEntitySelectorModalOrDrawerOpen?: boolean
    isOnChartTab?: boolean
    isOnMapTab?: boolean
    hideEntityControls?: boolean
}

interface EntitySelectionLabel {
    icon: React.ReactElement
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
        const { isOnChartTab, isOnMapTab, hideEntityControls } =
            this.props.manager
        if (hideEntityControls) return false
        return !!((isOnChartTab || isOnMapTab) && this.label)
    }

    @computed get label(): EntitySelectionLabel | null {
        const {
            entityType = "",
            entityTypePlural = "",
            canHighlightEntities,
            canChangeEntity,
            canAddEntities,
            isOnMapTab,
        } = this.props.manager

        return isOnMapTab
            ? {
                  action: "Select",
                  entity: MAP_GRAPHER_ENTITY_TYPE_PLURAL,
                  icon: <FontAwesomeIcon icon={faPen} />,
              }
            : canHighlightEntities
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
                        icon: <FontAwesomeIcon icon={faPen} />,
                    }
                  : null
    }

    render(): React.ReactElement | null {
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
