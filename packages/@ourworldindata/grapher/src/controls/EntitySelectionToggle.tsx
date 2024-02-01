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
    showSelectEntitiesButton?: boolean
    showChangeEntityButton?: boolean
    showAddEntityButton?: boolean
    entityType?: string
    entityTypePlural?: string
    isSelectingData?: boolean
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
            showSelectEntitiesButton,
            showChangeEntityButton,
            showAddEntityButton,
        } = this.props.manager

        return showSelectEntitiesButton
            ? {
                  action: "Select",
                  entity: entityTypePlural,
                  icon: <FontAwesomeIcon icon={faEye} />,
              }
            : showChangeEntityButton
            ? {
                  action: "Change",
                  entity: entityType,
                  icon: <FontAwesomeIcon icon={faRightLeft} />,
              }
            : showAddEntityButton
            ? {
                  action: "Edit",
                  entity: entityTypePlural,
                  icon: <FontAwesomeIcon icon={faPencilAlt} />,
              }
            : null
    }

    render(): JSX.Element | null {
        const { showToggle, label } = this
        const { isSelectingData: active } = this.props.manager

        return showToggle && label ? (
            <div className="entity-selection-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={(e): void => {
                        this.props.manager.isSelectingData = !active
                        e.stopPropagation()
                    }}
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
