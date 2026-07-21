import * as React from "react"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEye, faRightLeft, faPen } from "@fortawesome/free-solid-svg-icons"
import classnames from "clsx"
import { GrapherWindowType } from "@ourworldindata/types"
import { measureButtonWidth } from "./controlsRow/ControlsRowConstants"

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
}

interface EntitySelectionLabel {
    icon: React.ReactElement
    action: string
    entity: string
}

interface EntitySelectionToggleProps {
    manager: EntitySelectionManager
    showEntityLabel?: boolean
}

@observer
export class EntitySelectionToggle extends React.Component<EntitySelectionToggleProps> {
    constructor(props: EntitySelectionToggleProps) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: EntitySelectionManager): boolean {
        const {
            isOnChartTab,
            isOnMapTab,
            hideEntityControls,
            shouldShowEntitySelectorAs,
            canChangeAddOrHighlightEntities,
        } = manager

        if (hideEntityControls) return false

        const shouldShowDrawer =
            shouldShowEntitySelectorAs === GrapherWindowType.drawer
        const shouldShowModal =
            shouldShowEntitySelectorAs === GrapherWindowType.modal

        if (isOnMapTab) return shouldShowDrawer

        return !!(
            isOnChartTab &&
            canChangeAddOrHighlightEntities &&
            (shouldShowModal || shouldShowDrawer) &&
            getEntitySelectionLabel(manager)
        )
    }

    static estimateWidth(
        manager: EntitySelectionManager,
        {
            showEntityLabel,
        }: Required<Omit<EntitySelectionToggleProps, "manager">>
    ): number {
        if (!EntitySelectionToggle.shouldShow(manager)) return 0
        const label = getEntitySelectionLabel(manager)
        if (!label) return 0
        const text = showEntityLabel
            ? `${label.action} ${label.entity}`
            : label.action
        return measureButtonWidth(text)
    }

    @computed private get shouldShow(): boolean {
        return EntitySelectionToggle.shouldShow(this.props.manager)
    }

    @computed get label(): EntitySelectionLabel | null {
        return getEntitySelectionLabel(this.props.manager)
    }

    override render(): React.ReactElement | null {
        const { shouldShow, label } = this
        const { showEntityLabel = true } = this.props
        const { isEntitySelectorModalOrDrawerOpen: active } = this.props.manager

        return shouldShow && label ? (
            <div className="entity-selection-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={action((e): void => {
                        this.props.manager.isEntitySelectorModalOrDrawerOpen =
                            !active
                        e.stopPropagation()
                    })}
                    type="button"
                    data-track-note="chart_add_entity"
                    aria-label={`${label.action} ${label.entity}`}
                >
                    {label.icon}
                    <label className="label">
                        {showEntityLabel ? (
                            <>
                                {label.action} <span>{label.entity}</span>
                            </>
                        ) : (
                            label.action
                        )}
                    </label>
                </button>
            </div>
        ) : null
    }
}

function getEntitySelectionLabel(
    manager: EntitySelectionManager
): EntitySelectionLabel | null {
    const {
        entityType = "",
        entityTypePlural = "",
        canHighlightEntities,
        canChangeEntity,
        canAddEntities,
        isOnMapTab,
    } = manager

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
