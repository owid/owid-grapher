import { useMemo } from "react"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { makeImageSrc } from "../../imagesHelpers.js"
import { useImages } from "../../useImages.js"
import { BlockFrame } from "./BlockFrame.js"

const PREVIEW_WIDTH = 850

export function ImageBlockView(props: NodeViewProps): React.ReactElement {
    const { node, selected } = props
    const filename = String(node.attrs.filename ?? "")
    const smallFilename = node.attrs.smallFilename as string | null
    const { data: images = [] } = useImages()

    const image = useMemo(
        () => images.find((candidate) => candidate.filename === filename),
        [images, filename]
    )

    return (
        <NodeViewWrapper
            className={`rich-atom-block rich-image-block${
                selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={props}
                label="image"
                summary={`${filename}${
                    smallFilename ? ` · mobile: ${smallFilename}` : ""
                }`}
            />
            <figure contentEditable={false}>
                {image ? (
                    <img
                        src={makeImageSrc(image.cloudflareId, PREVIEW_WIDTH)}
                        alt={String(node.attrs.alt ?? image.defaultAlt ?? "")}
                        width={image.originalWidth ?? undefined}
                    />
                ) : (
                    <div className="rich-image-block__missing">
                        {filename
                            ? `Image "${filename}" not found in the library`
                            : "No image selected"}
                    </div>
                )}
            </figure>
        </NodeViewWrapper>
    )
}
