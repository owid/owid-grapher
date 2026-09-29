import { useMemo, useState } from "react"
import { Button, Tag } from "antd"
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ImageSelectorModal } from "../../ImageSelectorModal.js"
import { makeImageSrc } from "../../imagesHelpers.js"
import { useImages } from "../../useImages.js"

const PREVIEW_WIDTH = 850

export function ImageBlockView(props: NodeViewProps): React.ReactElement {
    const { node, updateAttributes, selected } = props
    const filename = String(node.attrs.filename ?? "")
    const smallFilename = node.attrs.smallFilename as string | null
    const { data: images = [] } = useImages()
    const [selectorOpen, setSelectorOpen] = useState(false)

    const image = useMemo(
        () => images.find((candidate) => candidate.filename === filename),
        [images, filename]
    )

    return (
        <NodeViewWrapper
            className={`rich-image-block${selected ? " rich-block--selected" : ""}`}
            data-drag-handle
        >
            <div className="rich-block__toolbar" contentEditable={false}>
                <Tag>image</Tag>
                <span className="rich-block__toolbar-info">
                    {filename}
                    {smallFilename ? ` · mobile: ${smallFilename}` : ""}
                </span>
                <Button size="small" onClick={() => setSelectorOpen(true)}>
                    Replace…
                </Button>
            </div>
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
            <ImageSelectorModal
                open={selectorOpen}
                onSelect={(newFilename) => {
                    updateAttributes({ filename: newFilename })
                    setSelectorOpen(false)
                }}
                onCancel={() => setSelectorOpen(false)}
            />
        </NodeViewWrapper>
    )
}
