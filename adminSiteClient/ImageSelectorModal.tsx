import { useMemo, useState } from "react"
import * as React from "react"
import { Input, Modal, Spin } from "antd"
import { makeImageSrc } from "./imagesHelpers.js"
import { useImages } from "./useImages.js"

import "./ImageSelectorModal.scss"

const THUMBNAIL_WIDTH = 200

export function ImageSelectorModal(props: {
    open: boolean
    onSelect: (filename: string) => void
    onCancel: () => void
}): React.ReactElement {
    const { open, onSelect, onCancel } = props

    const { data: images = [], isLoading } = useImages()
    const [searchValue, setSearchValue] = useState("")

    const filteredImages = useMemo(() => {
        const sorted = [...images].sort(
            (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
        )
        if (!searchValue.trim()) return sorted
        const terms = searchValue.toLowerCase().split(/\s+/)
        return sorted.filter((img) => {
            const haystack = `${img.filename} ${img.defaultAlt}`.toLowerCase()
            return terms.every((term) => haystack.includes(term))
        })
    }, [images, searchValue])

    return (
        <Modal
            title="Select an image"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={720}
            destroyOnClose
        >
            <Input
                placeholder="Search by filename or alt text..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                allowClear
                className="ImageSelectorModal__search"
            />
            {isLoading ? (
                <div className="ImageSelectorModal__loading">
                    <Spin />
                </div>
            ) : filteredImages.length === 0 ? (
                <div className="ImageSelectorModal__empty">
                    {searchValue
                        ? "No images match your search."
                        : "No images found."}
                </div>
            ) : (
                <div className="ImageSelectorModal__grid">
                    {filteredImages.map((image) => (
                        <button
                            key={image.id}
                            className="ImageSelectorModal__item"
                            onClick={() => onSelect(image.filename)}
                            title={image.defaultAlt || image.filename}
                        >
                            <img
                                src={makeImageSrc(
                                    image.cloudflareId,
                                    THUMBNAIL_WIDTH
                                )}
                                alt={image.defaultAlt}
                                className="ImageSelectorModal__thumbnail"
                                loading="lazy"
                            />
                            <span className="ImageSelectorModal__filename">
                                {image.filename}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    )
}
