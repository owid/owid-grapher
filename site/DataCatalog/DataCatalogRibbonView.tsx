import { Region } from "@ourworldindata/utils"
import { DataCatalogRibbon } from "./DataCatalogRibbon.js"
import { DataCatalogRibbonViewSkeleton } from "./DataCatalogSkeletons.js"
import { DataCatalogRibbonResult } from "./DataCatalogUtils.js"
import { CatalogComponentStyle } from "./DataCatalogState.js"

export const DataCatalogRibbonView = ({
    addTopic,
    results,
    selectedCountries,
    topics,
    isLoading,
    style,
}: {
    addTopic: (x: string) => void
    results?: DataCatalogRibbonResult[]
    selectedCountries: Region[]
    topics: Set<string>
    isLoading: boolean
    style: CatalogComponentStyle
}) => {
    if (isLoading) {
        return <DataCatalogRibbonViewSkeleton topics={topics} />
    }

    // const resultsSortedByHitCount = results?.sort((a, b) => b.nbHits - a.nbHits)
    return (
        <div
            className="span-cols-14 grid grid-cols-12-full-width data-catalog-ribbons"
            style={{ marginTop: 32 }}
        >
            {results?.map((result) => (
                <DataCatalogRibbon
                    key={result.title}
                    result={result}
                    addTopic={addTopic}
                    selectedCountries={selectedCountries}
                    style={style}
                />
            ))}
        </div>
    )
}
