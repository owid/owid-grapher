import React from "react"
import { dayjs } from "@ourworldindata/utils"
import { DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID } from "../SharedDataPageConstants.js"

interface IndicatorKeyDataProps {
    attribution: string
    processedAdapted: string
    dateRange?: string
    lastUpdated: string
    nextUpdate?: string
    unit?: string
}

export const IndicatorKeyData = (props: IndicatorKeyDataProps) => {
    const lastUpdated = dayjs(props.lastUpdated, ["YYYY", "YYYY-MM-DD"])
    const keyDataCount = 3 + (props.nextUpdate ? 1 : 0) + (props.unit ? 1 : 0)
    return (
        <div className="indicator-key-data">
            <div className="indicator-key-data__title">Source</div>
            <div className="indicator-key-data__content indicator-key-data__content-source">
                {props.attribution} – with{" "}
                <a href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}>
                    {props.processedAdapted}
                </a>{" "}
                by Our World In Data
            </div>
            <div className="indicator-key-data__title">Last updated</div>
            <div className="indicator-key-data__content">
                {lastUpdated.format("MMMM D, YYYY")}
            </div>
            {props.nextUpdate && (
                <>
                    <div className="indicator-key-data__title">
                        Next expected update
                    </div>
                    <div className="indicator-key-data__content">
                        {props.nextUpdate}
                    </div>
                </>
            )}
            <div className="indicator-key-data__title">Date range</div>
            <div className="indicator-key-data__content">{props.dateRange}</div>
            {props.unit && (
                <>
                    <div className="indicator-key-data__title">Unit</div>
                    <div className="indicator-key-data__content">
                        {props.unit}
                    </div>
                </>
            )}
            {/* needed for its top-border */}
            {keyDataCount % 2 === 0 && (
                <>
                    <div className="indicator-key-data__title empty" />
                    <div className="indicator-key-data__content empty" />
                </>
            )}
        </div>
    )
}
