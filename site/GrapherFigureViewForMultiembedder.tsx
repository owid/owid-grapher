import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"

// Wrapper for Grapher that uses css on figure element to determine the bounds
export const GrapherFigureViewForMultiembedder = ({
    slug,
}: {
    slug: string
    extraProps?: Partial<GrapherProgrammaticInterface>
}) => {
    return <figure data-grapher-src={`${BAKED_GRAPHER_URL}/${slug}`}></figure>
}
