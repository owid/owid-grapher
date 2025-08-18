import cx from "classnames"
import { useLinkedStaticViz } from "../utils.js"
import Image, { ImageParentContainer } from "./Image.js"
import { DocumentContext } from "../DocumentContext.js"
import { useContext } from "react"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { Container } from "./layout.js"

interface StaticVizProps {
    name: string
    className?: string
    containerType?: Container
}

export default function StaticViz(props: StaticVizProps) {
    const { name, className, containerType = "default" } = props
    const staticViz = useLinkedStaticViz(name)
    const { isPreviewing } = useContext(DocumentContext)

    if (!staticViz) {
        if (isPreviewing) {
            return (
                <BlockErrorFallback
                    className={cx("static-viz", className)}
                    error={{
                        name: "StaticViz error",
                        message: `StaticViz with name "${name}" not found. This block will not render when the page is baked.`,
                    }}
                />
            )
        }
        return null
    }

    // Map Container to ImageParentContainer
    const imageContainerType: ImageParentContainer =
        containerType === "sticky-right-left-heading-column"
            ? "default"
            : containerType

    return (
        <figure className={cx("static-viz", className)}>
            <Image
                hasOutline
                imageData={staticViz.desktop}
                smallImageData={staticViz.mobile}
                containerType={imageContainerType}
                shouldHideDownloadButton
            />
        </figure>
    )
}
