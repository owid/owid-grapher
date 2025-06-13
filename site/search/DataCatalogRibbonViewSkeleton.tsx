import cx from "classnames"
import { ChartSkeleton } from "./ChartSkeleton.js"

export const DataCatalogRibbonViewSkeleton = ({
    topics,
}: {
    topics: Set<string>
}) => {
    const RibbonSkeleton = () => (
        <div className="data-catalog-ribbon span-cols-12 col-start-2">
            <div className="data-catalog-ribbon__header--skeleton"></div>
            <ul className="data-catalog-ribbon-list data-catalog-ribbon-list--skeleton grid grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <ChartSkeleton key={i} />
                ))}
            </ul>
            <div className="data-catalog-ribbon__see-all-button--skeleton" />
        </div>
    )
    return (
        <>
            <div className="data-catalog-ribbons span-cols-14 grid grid-cols-12-full-width">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <RibbonSkeleton key={i} />
                ))}
            </div>
        </>
    )
}
