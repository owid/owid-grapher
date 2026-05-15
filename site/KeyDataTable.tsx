import { DataPageDataV2, joinTitleFragments } from "@ourworldindata/types"
import {
    makeSource,
    makeLastUpdated,
    makeNextUpdate,
    makeDateRange,
    makeUnit,
    makeUnitConversionFactor,
    SimpleMarkdownText,
} from "@ourworldindata/components"

export default function KeyDataTable({
    datapageData,
    attribution,
}: {
    datapageData: DataPageDataV2
    attribution: string
}) {
    const source = makeSource({
        attribution: attribution,
        owidProcessingLevel: datapageData.owidProcessingLevel,
    })
    const lastUpdated = makeLastUpdated(datapageData)
    const nextUpdate = makeNextUpdate(datapageData)
    const dateRange = makeDateRange(datapageData)
    const unit = makeUnit(datapageData)
    const unitConversionFactor = makeUnitConversionFactor(datapageData)

    return (
        <div className="key-data-block grid grid-cols-4 grid-sm-cols-12">
            {datapageData.descriptionShort && (
                <div className="key-data span-cols-4 span-sm-cols-12">
                    <div className="key-data-description-short__title">
                        {datapageData.title.title}
                    </div>
                    <div className="key-data-description-short__title-fragments">
                        {
                            // This method may return undefined if both fields are empty
                            joinTitleFragments(
                                datapageData.attributionShort,
                                datapageData.titleVariant
                            )
                        }
                    </div>
                    <div>
                        <SimpleMarkdownText
                            text={datapageData.descriptionShort}
                            useParagraphs={false}
                        />
                    </div>
                </div>
            )}
            {source && (
                <div className="key-data span-cols-4 span-sm-cols-12">
                    <div className="key-data__title">Source</div>
                    <div>{source}</div>
                </div>
            )}
            {lastUpdated && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Last updated</div>
                    <div>{lastUpdated}</div>
                </div>
            )}
            {nextUpdate && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Next expected update</div>
                    <div>{nextUpdate}</div>
                </div>
            )}
            {dateRange && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Date range</div>
                    <div>{dateRange}</div>
                </div>
            )}
            {unit && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Unit</div>
                    <div>{unit}</div>
                </div>
            )}
            {unitConversionFactor && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">
                        Unit conversion factor
                    </div>
                    <div>{unitConversionFactor}</div>
                </div>
            )}
        </div>
    )
}
