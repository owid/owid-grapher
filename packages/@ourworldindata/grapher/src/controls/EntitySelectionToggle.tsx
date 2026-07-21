import * as React from "react"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEye, faRightLeft, faPen } from "@fortawesome/free-solid-svg-icons"
import classnames from "clsx"
import { match } from "ts-pattern"
import { GrapherWindowType } from "@ourworldindata/types"
import {
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
} from "../core/GrapherConstants"
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

/**
 * How verbose the button label is: the full entity name
 * ("Edit countries and regions"), a shortened one ("Edit countries"),
 * or the action alone ("Edit").
 */
export type EntityLabelMode = "full" | "short" | "action-only"

interface EntitySelectionToggleProps {
    manager: EntitySelectionManager
    entityLabelMode?: EntityLabelMode
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
            entityLabelMode,
        }: Required<Omit<EntitySelectionToggleProps, "manager">>
    ): number {
        if (!EntitySelectionToggle.shouldShow(manager)) return 0
        const label = getEntitySelectionLabel(manager)
        if (!label) return 0
        const entityName = getEntityName(label, entityLabelMode)
        const text = entityName ? `${label.action} ${entityName}` : label.action
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
        const { entityLabelMode = "full" } = this.props
        const { isEntitySelectorModalOrDrawerOpen: active } = this.props.manager

        const entityName = label
            ? getEntityName(label, entityLabelMode)
            : undefined

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
                        {entityName ? (
                            <>
                                {label.action} <span>{entityName}</span>
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

/** The entity name rendered next to the action, undefined if action-only */
function getEntityName(
    label: EntitySelectionLabel,
    mode: EntityLabelMode
): string | undefined {
    return match(mode)
        .with("full", () => label.entity)
        .with("short", () => getShortEntityName(label.entity))
        .with("action-only", () => undefined)
        .exhaustive()
}

// Only the default entity types have a short version
const SHORT_ENTITY_NAMES: Record<string, string> = {
    [DEFAULT_GRAPHER_ENTITY_TYPE]: "country",
    [DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL]: "countries",
}

function getShortEntityName(entity: string): string {
    return SHORT_ENTITY_NAMES[entity] ?? entity
}
