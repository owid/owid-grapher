import { useAtom, useAtomValue } from "jotai"
import {
    atomCountriesOrRegionsMode,
    atomCurrentCurrency,
    atomCurrentTab,
    atomCurrentYear,
    atomSelectedCountryNames,
    atomTimeInterval,
} from "../store.ts"
import * as R from "remeda"
import { IncomePlotCountrySelector } from "./IncomePlotCountrySelector.tsx"
import { LabeledSwitch } from "@ourworldindata/components"
import cx from "classnames"

import * as React from "react"
import { Tabs as AriaTabs, TabList, Tab } from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGlobe, faFlag } from "@fortawesome/free-solid-svg-icons"

export interface TabItem<TabKey extends string = string> {
    key: TabKey
    element: React.ReactElement
}

export const Tabs = <TabKey extends string = string>({
    items,
    selectedKey,
    onChange,
    className,
    variant = "default",
}: {
    items: TabItem<TabKey>[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    className?: string
    variant?: "default" | "slim" | "stretch" | "scroll"
}) => {
    return (
        <AriaTabs
            selectedKey={selectedKey}
            onSelectionChange={(key) => {
                if (typeof key === "string") onChange(key as TabKey)
            }}
        >
            <TabList
                className={cx("Tabs", "Tabs--variant-" + variant, className)}
            >
                {items.map((item) => (
                    <Tab
                        key={item.key}
                        id={item.key}
                        className={cx("Tabs__Tab")}
                    >
                        {item.element}
                    </Tab>
                ))}
            </TabList>
        </AriaTabs>
    )
}

export const IncomePlotControlsRowTop = () => {
    const [currentTab, setCurrentTab] = useAtom(atomCurrentTab)
    const [countriesOrRegionsMode, nextCountriesOrRegionsMode] = useAtom(
        atomCountriesOrRegionsMode
    )
    const selectedCountryNames = useAtomValue(atomSelectedCountryNames)

    const isGlobal = currentTab === "global"
    const isCountries = currentTab === "countries"

    return (
        <div className="income-plot-controls-top" style={{ marginBottom: 10 }}>
            <Tabs
                variant="slim"
                items={[
                    {
                        key: "global",
                        element: (
                            <span>
                                <FontAwesomeIcon icon={faGlobe} />
                                Global
                            </span>
                        ),
                    },
                    {
                        key: "countries",
                        element: (
                            <span>
                                <FontAwesomeIcon icon={faFlag} />
                                Selected countries (
                                {selectedCountryNames.length})
                            </span>
                        ),
                    },
                ]}
                selectedKey={currentTab}
                onChange={setCurrentTab}
            />
            {isGlobal && (
                <div className="regions-countries-toggle">
                    <span
                        className={cx("toggle-label", {
                            active: countriesOrRegionsMode === "regions",
                        })}
                        onClick={() => {
                            if (countriesOrRegionsMode !== "regions")
                                nextCountriesOrRegionsMode()
                        }}
                    >
                        Show regions
                    </span>
                    <LabeledSwitch
                        value={countriesOrRegionsMode === "countries"}
                        onToggle={nextCountriesOrRegionsMode}
                    />
                    <span
                        className={cx("toggle-label", {
                            active: countriesOrRegionsMode === "countries",
                        })}
                        onClick={() => {
                            if (countriesOrRegionsMode !== "countries")
                                nextCountriesOrRegionsMode()
                        }}
                    >
                        Show countries
                    </span>
                </div>
            )}
            {isCountries && <IncomePlotCountrySelector />}
        </div>
    )
}

export const IncomePlotControlsRowBottom = ({
    isNarrow = false,
}: {
    isNarrow?: boolean
}) => {
    const [timeInterval, nextTimeInterval] = useAtom(atomTimeInterval)
    const [currentYear] = useAtom(atomCurrentYear)
    const [currentCurrency, nextCurrency] = useAtom(atomCurrentCurrency)

    return (
        <div className="income-plot-controls-bottom">
            <button onClick={() => nextTimeInterval()} className="control-pill">
                {R.toTitleCase(timeInterval)}
            </button>
            <span className="control-text">income or consumption in</span>
            <button className="control-pill">{currentYear}</button>
            <span className="control-text">in</span>
            <button onClick={() => nextCurrency()} className="control-pill">
                {currentCurrency === "INTD"
                    ? "international-$"
                    : R.toUpperCase(currentCurrency)}
            </button>
        </div>
    )
}
