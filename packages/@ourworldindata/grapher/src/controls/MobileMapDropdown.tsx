import * as _ from "lodash-es"
import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { MapConfig } from "../mapCharts/MapConfig"
import {
    EntityName,
    FuzzySearch,
    getRegionAlternativeNames,
    getUserNavigatorLanguagesNonEnglish,
    GlobeRegionName,
    mappableCountries,
    MapRegionName,
    checkIsOwidIncomeGroupName,
    getUserCountryInformation,
    regions,
} from "@ourworldindata/utils"
import { GlobeController } from "../mapCharts/GlobeController"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLocationArrow } from "@fortawesome/free-solid-svg-icons"
import { SearchDropdown } from "./SearchDropdown"
import {
    Dropdown,
    DropdownCollection,
    DropdownCollectionItem,
    DropdownOptionGroup,
} from "./Dropdown.js"
import { MAP_REGION_LABELS } from "../mapCharts/MapChartConstants"
import { match } from "ts-pattern"
import * as R from "remeda"
import { MapZoomToCountryOrContinentDropdown } from "./MapZoomToCountryOrContinentDropdown"
import { MapRegionDropdown } from "./MapRegionDropdown"

export interface MobileMapDropdownManager {
    mapConfig?: MapConfig
    isOnMapTab?: boolean
    isFaceted?: boolean
    hideMapRegionDropdown?: boolean
    isMapSelectionEnabled?: boolean
    globeController?: GlobeController
    onMapCountryDropdownFocus?: () => void
}

interface DropdownOption {
    type: "country" | "continent" | "world"
    label: string
    value: string
    isLocal?: boolean
    alternativeNames?: string[]
    trackNote: "map_zoom_mobile"
}

type GroupedDropdownOption = DropdownOptionGroup<DropdownOption>

function isGroupedOption(
    item: DropdownCollectionItem<DropdownOption>
): item is GroupedDropdownOption {
    return (item as GroupedDropdownOption).options !== undefined
}

@observer
export class MobileMapDropdown extends React.Component<{
    manager: MobileMapDropdownManager
}> {
    private searchInput = ""
    private localEntityNames: EntityName[] | undefined = undefined

    constructor(props: { manager: MobileMapDropdownManager }) {
        super(props)

        makeObservable<MobileMapDropdown, "searchInput" | "localEntityNames">(
            this,
            {
                searchInput: observable,
                localEntityNames: observable,
            }
        )
    }

    static shouldShow(manager: MobileMapDropdownManager): boolean {
        const menu = new MobileMapDropdown({ manager })
        return menu.showMenu
    }

    @computed private get showMenu(): boolean {
        const { isMapSelectionEnabled, isOnMapTab, mapConfig, isFaceted } =
            this.props.manager
        return !!(
            isOnMapTab &&
            !isMapSelectionEnabled &&
            (!mapConfig?.is2dContinentActive() || isFaceted) &&
            !mapConfig?.globe.isActive
        )
    }

    @computed
    private get manager(): MobileMapDropdownManager {
        return this.props.manager
    }

    override render(): React.ReactElement | null {
        return this.manager.isFaceted ? (
            <MapRegionDropdown manager={this.manager} />
        ) : (
            <MapZoomToCountryOrContinentDropdown manager={this.manager} />
        )
    }
}
