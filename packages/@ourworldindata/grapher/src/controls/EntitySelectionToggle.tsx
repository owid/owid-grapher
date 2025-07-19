import * as React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEye, faRightLeft, faPen } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"
import { GrapherWindowType } from "@ourworldindata/types"
import { MapConfig } from "../mapCharts/MapConfig"

export interface EntitySelectionManager {
    canHighlightEntities?: boolean
    canChangeEntity?: boolean
    canAddEntities?: boolean
    canChangeAddOrHighlightEntities?: boolean
    entityType?: string
    entityTypePlural?: string
    isEntitySelectorModalOrDrawerOpen?: boolean
    isOnChartTab?: boolean
    isOnMapTab?: boolean
    hideEntityControls?: boolean
    shouldShowEntitySelectorAs?: GrapherWindowType
    isMapSelectionEnabled?: boolean
    mapConfig?: MapConfig
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
    constructor(props: { manager: EntitySelectionManager }) {
        super(props)
        makeObservable(this)
    }

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
            canChangeAddOrHighlightEntities,
            isMapSelectionEnabled,
            mapConfig,
        } = this.props.manager

        if (hideEntityControls) return false

        // Don't show toggle if the entity selector is always visible
        if (shouldShowEntitySelectorAs === GrapherWindowType.panel) return false

        // Sanity check: Don't show toggle if there's no label to display
        if (!this.label) return false

        // On the map tab, show the toggle if map selection is enabled and
        // the globe is not active. If the globe is active, we only show a
        // single control, the 'Back to map' button
        if (isOnMapTab)
            return !!(isMapSelectionEnabled && !mapConfig?.globe.isActive)

        // On the chart tab, show the toggle if entity selection is enabled
        if (isOnChartTab) return !!canChangeAddOrHighlightEntities

        return false
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

        if (isOnMapTab)
            return {
                action: "Select",
                entity: "countries",
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
