import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEye, faRightLeft, faPen } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"
import { GrapherWindowType } from "@ourworldindata/types"

export interface EntitySelectionManager {
    canHighlightEntities?: boolean
    canChangeEntity?: boolean
    canAddEntities?: boolean
    entityType?: string
    entityTypePlural?: string
    mapEntityTypePlural?: string
    isEntitySelectorModalOrDrawerOpen?: boolean
    isOnChartTab?: boolean
    isOnMapTab?: boolean
    hideEntityControls?: boolean
    shouldShowEntitySelectorAs?: GrapherWindowType
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
        const {
            isOnChartTab,
            isOnMapTab,
            hideEntityControls,
            shouldShowEntitySelectorAs,
        } = this.props.manager
        if (hideEntityControls) return false
        if (isOnMapTab)
            return shouldShowEntitySelectorAs === GrapherWindowType.drawer
        return !!(isOnChartTab && this.label)
    }

    @computed get label(): EntitySelectionLabel | null {
        const {
            entityType = "",
            entityTypePlural = "",
            mapEntityTypePlural = "",
            canHighlightEntities,
            canChangeEntity,
            canAddEntities,
            isOnMapTab,
        } = this.props.manager

        if (isOnMapTab)
            return {
                action: "Select",
                entity: mapEntityTypePlural,
                icon: <FontAwesomeIcon icon={faPen} />,
            }

        if (canHighlightEntities)
            return {
                action: "Select",
                entity: entityTypePlural,
                icon: <FontAwesomeIcon icon={faEye} />,
            }

        if (canChangeEntity)
            return {
                action: "Change",
                entity: entityType,
                icon: <FontAwesomeIcon icon={faRightLeft} />,
            }

        if (canAddEntities)
            return {
                action: "Edit",
                entity: entityTypePlural,
                icon: <FontAwesomeIcon icon={faPen} />,
            }

        return null
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
