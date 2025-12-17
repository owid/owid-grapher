import cx from "classnames"
import { HybridLinkList } from "./HybridLinkList.js"
import { useLinkedChart, useLinkedDocument } from "../utils.js"
import { useContext } from "react"
import { DocumentContext } from "../DocumentContext.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"

export const ProminentLink = (props: {
    url: string
    className: string
    title?: string
    description?: string
    thumbnail?: string
}) => {
    const { errorMessage: documentErrorMessage } = useLinkedDocument(props.url)
    const { errorMessage: linkedChartErrorMessage } = useLinkedChart(props.url)
    const errorMessage = documentErrorMessage || linkedChartErrorMessage
    const { isPreviewing } = useContext(DocumentContext)

    if (errorMessage) {
        if (isPreviewing) {
            return (
                <div className={props.className}>
                    <BlockErrorFallback
                        className="span-cols-6 span-md-cols-10 span-sm-cols-12"
                        error={{
                            name: "Error with prominent link",
                            message: `${errorMessage} This block won't render when the page is published`,
                        }}
                    />
                </div>
            )
        } else return null
    }

    return (
        <div className={cx("prominent-link", props.className)}>
            <HybridLinkList
                links={[
                    // Map the prominent link props to a single hybrid link
                    {
                        url: props.url,
                        title: props.title,
                        subtitle: props.description,
                        thumbnail: props.thumbnail,
                        type: "hybrid-link",
                    },
                ]}
            />
        </div>
    )
}
