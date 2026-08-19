import * as React from "react"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEye, faRightLeft, faPen } from "@fortawesome/free-solid-svg-icons"
import classnames from "clsx"
import { GrapherWindowType } from "@ourworldindata/types"
import {
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
} from "../core/GrapherConstants"

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
    /**
     * Optional tail of the entity name that is dropped before
     * the entity name collapses entirely
     */
    entitySuffix?: string
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
        } = this.props.manager

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
            this.label
        )
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
                ...splitDefaultEntityLabel(entityTypePlural),
                icon: <FontAwesomeIcon icon={faEye} />,
            }

        if (canChangeEntity)
            return {
                action: "Change",
                ...splitDefaultEntityLabel(entityType),
                icon: <FontAwesomeIcon icon={faRightLeft} />,
            }

        if (canAddEntities)
            return {
                action: "Edit",
                ...splitDefaultEntityLabel(entityTypePlural),
                icon: <FontAwesomeIcon icon={faPen} />,
            }

        return null
    }

    override render(): React.ReactElement | null {
        const { showToggle, label } = this
        const { isEntitySelectorModalOrDrawerOpen: active } = this.props.manager

        return showToggle && label ? (
            <div
                className={classnames("entity-selection-menu", {
                    "entity-selection-menu--shortenable": !!label.entitySuffix,
                })}
            >
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={action((e): void => {
                        this.props.manager.isEntitySelectorModalOrDrawerOpen =
                            !active
                        e.stopPropagation()
                    })}
                    type="button"
                    data-track-note="chart_add_entity"
                    aria-label={`${label.action} ${label.entity}${label.entitySuffix ?? ""}`}
                >
                    {label.icon}
                    <label className="label">
                        {label.action}{" "}
                        <span>
                            {label.entity}
                            {label.entitySuffix && (
                                <span className="entity-suffix">
                                    {label.entitySuffix}
                                </span>
                            )}
                        </span>
                    </label>
                </button>
            </div>
        ) : null
    }
}

/**
 * Splits the default entity type into a base and a droppable suffix
 * ("countries and regions" -> "countries" + " and regions")
 */
function splitDefaultEntityLabel(
    entity: string
): Pick<EntitySelectionLabel, "entity" | "entitySuffix"> {
    if (entity === DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL)
        return { entity: "countries", entitySuffix: " and regions" }
    if (entity === DEFAULT_GRAPHER_ENTITY_TYPE)
        return { entity: "country", entitySuffix: " or region" }
    return { entity }
}
