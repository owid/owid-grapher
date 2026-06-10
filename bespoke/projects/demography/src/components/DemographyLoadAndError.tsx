import { Spinner } from "../../../../components/Spinner/Spinner.js"

export function DemographyChartError() {
    return <div>Demography visualization can't be loaded</div>
}

export function DemographySkeleton() {
    return (
        <div className="demography-skeleton">
            <Spinner />
        </div>
    )
}
