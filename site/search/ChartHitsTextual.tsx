import { useEffect, useMemo, useState } from "react"
import {
    debounce,
    formatValue,
    getUserCountryInformation,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    pick,
    Region,
} from "@ourworldindata/utils"
import { ChartRecordType, IChartHit } from "./searchTypes.js"
import { getEntityQueryStr, pickEntitiesForChartHit } from "./SearchUtils.js"
import { HitAttributeHighlightResult } from "instantsearch.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons"
import { useHits, UseHitsProps } from "react-instantsearch"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"

export function ChartHitsTextual({
    searchQueryRegionsMatches,
    ...hitProps
}: {
    searchQueryRegionsMatches?: Region[] | undefined
} & UseHitsProps<IChartHit>) {
    const { items } = useHits(hitProps)
    if (items.length === 0) return null
    return (
        <ChartHitTextual
            hit={items[0]}
            searchQueryRegionsMatches={searchQueryRegionsMatches}
        />
    )
}

const ChartHitTextual = ({
    hit,
    searchQueryRegionsMatches,
}: {
    hit: IChartHit
    searchQueryRegionsMatches?: Region[] | undefined
}) => {
    const isExplorerView = hit.type === ChartRecordType.ExplorerView

    const entities = useMemo(
        () =>
            pickEntitiesForChartHit(
                hit._highlightResult?.availableEntities as
                    | HitAttributeHighlightResult[]
                    | undefined,
                hit.availableEntities,
                searchQueryRegionsMatches
            ),
        [
            hit._highlightResult?.availableEntities,
            hit.availableEntities,
            searchQueryRegionsMatches,
        ]
    )
    const entityQueryStr = useMemo(
        () => getEntityQueryStr(entities),
        [entities]
    )

    const fullQueryParams = isExplorerView
        ? hit.queryParams! + entityQueryStr.replace("?", "&")
        : entityQueryStr

    const chartUrl = isExplorerView
        ? `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${hit.slug}${fullQueryParams}`
        : `${BAKED_GRAPHER_URL}/${hit.slug}${fullQueryParams}`

    const [localRegionCodes, setLocalRegionCodes] = useState<string[]>([
        "OWID_WRL",
    ])
    const [data, setData] = useState<OwidVariableMixedData | null>(null)
    const [metadata, setMetadata] =
        useState<OwidVariableWithSourceAndDimension | null>(null)
    // const [date, setDate] = useState<number | undefined>(undefined)
    // const [value, setValue] = useState<number | string | undefined>(undefined)
    const [formattedValue, setFormattedValue] = useState<string | undefined>(
        undefined
    )
    const [formattedDate, setFormattedDate] = useState<string | undefined>(
        undefined
    )
    const [gptDescription, setGptDescription] = useState<string | null>(null)

    useEffect(() => {
        const fetchDataAndMetadata = async () => {
            try {
                const response = await fetch(chartUrl)
                const text = await response.text()
                const parser = new DOMParser()
                const doc = parser.parseFromString(text, "text/html")
                const dataLinkTag = doc.querySelector(
                    `link[href^="${DATA_API_URL}"][href$=".data.json"]`
                )
                const metadataLinkTag = doc.querySelector(
                    `link[href^="${DATA_API_URL}"][href$=".metadata.json"]`
                )
                if (!dataLinkTag || !metadataLinkTag) return

                const dataUrl = dataLinkTag.getAttribute("href")
                const metadataUrl = metadataLinkTag.getAttribute("href")
                // console.log("Data URL:", dataUrl)
                // console.log("Metadata URL:", metadataUrl)
                if (!dataUrl || !metadataUrl) return

                const dataResponse = await fetch(dataUrl)
                const jsonData = await dataResponse.json()
                // console.log("Chart Data JSON:", jsonData)
                const metadataResponse = await fetch(metadataUrl)
                const metadataJson = await metadataResponse.json()
                // console.log("Metadata JSON:", metadataJson)
                setData(jsonData)
                setMetadata(metadataJson)
            } catch (error) {
                console.error("Error fetching chart data:", error)
            }
        }

        const debouncedFetchDataAndMetadata = debounce(
            fetchDataAndMetadata,
            250
        )
        void debouncedFetchDataAndMetadata()

        return () => {
            debouncedFetchDataAndMetadata.cancel()
        }
    }, [chartUrl])

    useEffect(() => {
        const detectLocalRegion = async (): Promise<void> => {
            try {
                const localCountryInfo = await getUserCountryInformation()
                // console.log("Local Country Info:", localCountryInfo)
                if (!localCountryInfo) {
                    return
                }

                const localRegionCodes = [
                    localCountryInfo.code,
                    ...(localCountryInfo.regions ?? []),
                    "OWID_WRL",
                ]
                setLocalRegionCodes(localRegionCodes)
            } catch {
                console.error("Error detecting local region")
            }
        }
        void detectLocalRegion()
    }, [])

    const getEntityIdByRegionCode = (
        code: string
    ): [number, string | undefined] | undefined => {
        const entity = metadata?.dimensions.entities.values.find(
            (entity) => entity.code === code
        )
        if (!entity) return
        return [entity.id, entity.name]
    }

    const getValueForEntity = (
        entityId?: number,
        year?: number
    ): [number, number | string] | [] => {
        if (!data || !entityId) return []
        const entityIndices = data.entities.reduce<number[]>(
            (indices, e, i) => {
                if (e === entityId) indices.push(i)
                return indices
            },
            []
        )

        if (entityIndices.length === 0) return []

        const targetIndex =
            year !== undefined
                ? (entityIndices.find((i) => data.years[i] === year) ??
                  entityIndices[entityIndices.length - 1])
                : entityIndices[entityIndices.length - 1]

        const date = data.years[targetIndex]
        const value = data.values[targetIndex]
        return [date, value]
    }
    // TODO handle multiple local regions
    const [entityId, entityName] =
        getEntityIdByRegionCode(localRegionCodes[0]) || []

    // console.log("Entity ID:", entityId)
    const [date, value] = getValueForEntity(entityId)

    //TODO: remove effect
    useEffect(() => {
        if (value !== undefined && metadata) {
            setFormattedValue(
                typeof value === "number"
                    ? formatValue(value, { ...metadata.display })
                    : value
            )
        }
        if (
            metadata?.display?.yearIsDay &&
            metadata.display.zeroDay &&
            date !== undefined
        ) {
            // Special case for when the year is actually an offset in days (e.g. for COVID-19 data)
            const zeroDay = new Date(metadata.display.zeroDay)
            const offsetDate = new Date(zeroDay)
            offsetDate.setDate(zeroDay.getDate() + date)
            setFormattedDate(offsetDate.toISOString().split("T")[0])
        } else {
            setFormattedDate(date?.toString())
        }
    }, [date, value, metadata])

    useEffect(() => {
        const generateDataPointDescription = async () => {
            if (!formattedDate || !formattedValue || !metadata) return
            try {
                const response = await fetch(
                    "/admin/api/gpt/suggest-data-point-description",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            dataPoint: {
                                entity: entityName,
                                formattedValue,
                                formattedDate,
                            },
                            metadata: pick(metadata, [
                                "descriptionShort",
                                "name",
                                "display",
                            ]),
                        }),
                    }
                )
                const result = await response.json()
                setGptDescription(result.description)
            } catch (error) {
                console.error("Error generating data point description:", error)
            }
        }
        // console.log("generateDataPointDescription")
        void generateDataPointDescription()
    }, [formattedValue, formattedDate, metadata, entityName])

    return (
        <>
            {gptDescription && (
                <section className="chart-hit-textual">
                    <div className="chart-hit-textual__description">
                        <a href={chartUrl}>{gptDescription}</a>
                    </div>
                    <div className="chart-hit-textual__get-data"></div>
                    <div className="chart-hit-textual__debug">
                        <div className="chart-hit-textual__data">
                            <a href={`${chartUrl}?tab=table`}>Get the data</a>
                        </div>
                        {/* <div className="chart-hit-textual__data">
                            Date: {date}
                        </div>
                        <div className="chart-hit-textual__data">
                            Name: {metadata?.descriptionShort || metadata?.name}
                        </div>
                        <div className="chart-hit-textual__data">
                            Value: {formattedValue}
                        </div> */}
                        <div className="chart-hit-textual__data">
                            <a>Report</a>
                        </div>
                    </div>
                </section>
            )}
            {/* {entities.length > 0 && (
                <ul className="chart-hit-entities">
                    {entities.map((entity, i) => (
                        <li key={entity}>
                            {i === 0 && (
                                <FontAwesomeIcon
                                    className="chart-hit-icon"
                                    icon={faMapMarkerAlt}
                                />
                            )}
                            {entity}
                        </li>
                    ))}
                </ul>
            )} */}
        </>
    )
}
