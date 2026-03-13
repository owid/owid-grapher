import { useContext, useState } from "react"
import * as React from "react"
import { Button, Select, Upload } from "antd"
import { useQueryClient } from "@tanstack/react-query"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faImages, faUpload } from "@fortawesome/free-solid-svg-icons"
import { Slide, SlideTemplate, SlideMedia } from "@ourworldindata/types"
import { RcFile } from "antd/es/upload/interface.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    ACCEPTED_IMG_TYPES,
    fileToBase64,
    ImageUploadResponse,
} from "./imagesHelpers.js"
import { ImageSelectorModal } from "./ImageSelectorModal.js"

const TEMPLATE_OPTIONS = [
    { value: SlideTemplate.ImageChartOnly, label: "Image/Chart Only" },
    { value: SlideTemplate.Section, label: "Section" },
    { value: SlideTemplate.ImageChartWithText, label: "Image/Chart with Text" },
    { value: SlideTemplate.TitleSlide, label: "Title Slide" },
    { value: SlideTemplate.Blank, label: "Blank" },
    { value: SlideTemplate.TwoColumnText, label: "Two Column Text" },
    { value: SlideTemplate.Quote, label: "Quote" },
    { value: SlideTemplate.BigNumber, label: "Big Number" },
    { value: SlideTemplate.FullSlideImage, label: "Full Slide Image" },
]

const POPULAR_TEMPLATES = [
    SlideTemplate.ImageChartOnly,
    SlideTemplate.Section,
    SlideTemplate.ImageChartWithText,
]

function makeDefaultSlideForTemplate(template: SlideTemplate): Slide {
    switch (template) {
        case SlideTemplate.ImageChartOnly:
            return { template, media: null }
        case SlideTemplate.Section:
            return { template, title: "" }
        case SlideTemplate.ImageChartWithText:
            return { template, media: null, text: "" }
        case SlideTemplate.TitleSlide:
            return { template, title: "" }
        case SlideTemplate.Blank:
            return { template }
        case SlideTemplate.TwoColumnText:
            return { template, leftText: "", rightText: "" }
        case SlideTemplate.Quote:
            return { template, quote: "" }
        case SlideTemplate.BigNumber:
            return { template, number: "", label: "" }
        case SlideTemplate.FullSlideImage:
            return { template, media: null }
    }
}

export function SlideshowEditTab(props: {
    slide: Slide
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props

    const handleTemplateChange = (template: SlideTemplate) => {
        onUpdate(makeDefaultSlideForTemplate(template))
    }

    return (
        <div className="SlideshowEditTab">
            <fieldset>
                <legend>Select slide template</legend>

                <div className="SlideshowEditTab__popular-templates">
                    <p>Popular</p>
                    <div className="SlideshowEditTab__template-buttons">
                        {POPULAR_TEMPLATES.map((t) => {
                            const option = TEMPLATE_OPTIONS.find(
                                (o) => o.value === t
                            )
                            return (
                                <button
                                    key={t}
                                    className={`SlideshowEditTab__template-button ${
                                        slide.template === t
                                            ? "SlideshowEditTab__template-button--active"
                                            : ""
                                    }`}
                                    onClick={() => handleTemplateChange(t)}
                                >
                                    {option?.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="SlideshowEditTab__template-select">
                    <p>Select from all</p>
                    <Select
                        value={slide.template}
                        onChange={handleTemplateChange}
                        options={TEMPLATE_OPTIONS}
                        style={{ width: "100%" }}
                    />
                </div>
            </fieldset>

            <fieldset>
                <legend>Template options</legend>
                <TemplateOptionsEditor slide={slide} onUpdate={onUpdate} />
            </fieldset>
        </div>
    )
}

function MediaEditor(props: {
    media: SlideMedia | null
    onChange: (media: SlideMedia | null) => void
}): React.ReactElement {
    const { media, onChange } = props
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const [isImageSelectorOpen, setIsImageSelectorOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    return (
        <div className="SlideshowEditTab__media-editor">
            <div className="SlideshowEditTab__media-image-section">
                <Button
                    icon={<FontAwesomeIcon icon={faImages} />}
                    onClick={() => setIsImageSelectorOpen(true)}
                >
                    Browse images
                </Button>
                <Upload
                    accept={ACCEPTED_IMG_TYPES.join(",")}
                    showUploadList={false}
                    customRequest={async ({ file }) => {
                        const payload = await fileToBase64(file as RcFile)
                        if (!payload) return
                        setIsUploading(true)
                        try {
                            const response =
                                await admin.requestJSON<ImageUploadResponse>(
                                    "/api/images",
                                    payload,
                                    "POST"
                                )
                            if (response.success) {
                                onChange({
                                    type: "image",
                                    filename: response.image.filename,
                                })
                                await queryClient.invalidateQueries({
                                    queryKey: ["images"],
                                })
                            } else {
                                alert(response.errorMessage)
                            }
                        } finally {
                            setIsUploading(false)
                        }
                    }}
                >
                    <Button
                        icon={<FontAwesomeIcon icon={faUpload} />}
                        loading={isUploading}
                    >
                        Upload image
                    </Button>
                </Upload>
                {media?.type === "image" && (
                    <span className="SlideshowEditTab__media-selected-filename">
                        {media.filename}
                        <button
                            className="SlideshowEditTab__media-clear"
                            onClick={() => onChange(null)}
                            title="Clear image"
                        >
                            &times;
                        </button>
                    </span>
                )}
            </div>
            <ImageSelectorModal
                open={isImageSelectorOpen}
                onSelect={(filename) => {
                    onChange({ type: "image", filename })
                    setIsImageSelectorOpen(false)
                }}
                onCancel={() => setIsImageSelectorOpen(false)}
            />
            <p>or</p>
            <label>
                Enter grapher url:
                <input
                    type="text"
                    placeholder="https://ourworldindata.org/grapher/..."
                    value={media?.type === "grapher" ? media.url : ""}
                    onChange={(e) => {
                        const url = e.target.value
                        if (url) {
                            onChange({ type: "grapher", url })
                        } else {
                            onChange(null)
                        }
                    }}
                />
            </label>
        </div>
    )
}

function TemplateOptionsEditor(props: {
    slide: Slide
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props

    switch (slide.template) {
        case SlideTemplate.ImageChartOnly:
            return (
                <>
                    <MediaEditor
                        media={slide.media}
                        onChange={(media) => onUpdate({ ...slide, media })}
                    />
                    <label>
                        <input
                            type="checkbox"
                            checked={slide.sectionTitle !== undefined}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    sectionTitle: e.target.checked
                                        ? ""
                                        : undefined,
                                })
                            }
                        />{" "}
                        Section title
                    </label>
                    {slide.sectionTitle !== undefined && (
                        <input
                            type="text"
                            value={slide.sectionTitle}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    sectionTitle: e.target.value,
                                })
                            }
                            placeholder="Section title"
                        />
                    )}
                    <label>
                        <input
                            type="checkbox"
                            checked={slide.slideTitle !== undefined}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    slideTitle: e.target.checked
                                        ? ""
                                        : undefined,
                                })
                            }
                        />{" "}
                        Slide title
                    </label>
                    {slide.slideTitle !== undefined && (
                        <input
                            type="text"
                            value={slide.slideTitle}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    slideTitle: e.target.value,
                                })
                            }
                            placeholder="Slide title"
                        />
                    )}
                </>
            )

        case SlideTemplate.Section:
            return (
                <>
                    <label>
                        Title
                        <input
                            type="text"
                            value={slide.title}
                            onChange={(e) =>
                                onUpdate({ ...slide, title: e.target.value })
                            }
                            placeholder="Section title"
                        />
                    </label>
                    <label>
                        Subtitle
                        <input
                            type="text"
                            value={slide.subtitle ?? ""}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    subtitle: e.target.value || undefined,
                                })
                            }
                            placeholder="Subtitle (optional)"
                        />
                    </label>
                </>
            )

        case SlideTemplate.TitleSlide:
            return (
                <>
                    <label>
                        Title
                        <input
                            type="text"
                            value={slide.title}
                            onChange={(e) =>
                                onUpdate({ ...slide, title: e.target.value })
                            }
                            placeholder="Presentation title"
                        />
                    </label>
                    <label>
                        Subtitle
                        <input
                            type="text"
                            value={slide.subtitle ?? ""}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    subtitle: e.target.value || undefined,
                                })
                            }
                            placeholder="Subtitle (optional)"
                        />
                    </label>
                    <label>
                        Author
                        <input
                            type="text"
                            value={slide.author ?? ""}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    author: e.target.value || undefined,
                                })
                            }
                            placeholder="Author (optional)"
                        />
                    </label>
                    <label>
                        Date
                        <input
                            type="text"
                            value={slide.date ?? ""}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    date: e.target.value || undefined,
                                })
                            }
                            placeholder="Date (optional)"
                        />
                    </label>
                </>
            )

        case SlideTemplate.ImageChartWithText:
            return (
                <>
                    <MediaEditor
                        media={slide.media}
                        onChange={(media) => onUpdate({ ...slide, media })}
                    />
                    <label>
                        Text
                        <textarea
                            value={slide.text}
                            onChange={(e) =>
                                onUpdate({ ...slide, text: e.target.value })
                            }
                            placeholder="Supports **bold** and *italics*"
                            rows={4}
                        />
                    </label>
                </>
            )

        case SlideTemplate.TwoColumnText:
            return (
                <>
                    <label>
                        Left column
                        <textarea
                            value={slide.leftText}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    leftText: e.target.value,
                                })
                            }
                            placeholder="Supports **bold** and *italics*"
                            rows={4}
                        />
                    </label>
                    <label>
                        Right column
                        <textarea
                            value={slide.rightText}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    rightText: e.target.value,
                                })
                            }
                            placeholder="Supports **bold** and *italics*"
                            rows={4}
                        />
                    </label>
                </>
            )

        case SlideTemplate.Quote:
            return (
                <>
                    <label>
                        Quote
                        <textarea
                            value={slide.quote}
                            onChange={(e) =>
                                onUpdate({ ...slide, quote: e.target.value })
                            }
                            placeholder="Supports **bold** and *italics*"
                            rows={4}
                        />
                    </label>
                    <label>
                        Attribution
                        <input
                            type="text"
                            value={slide.attribution ?? ""}
                            onChange={(e) =>
                                onUpdate({
                                    ...slide,
                                    attribution: e.target.value || undefined,
                                })
                            }
                            placeholder="Attribution (optional)"
                        />
                    </label>
                </>
            )

        case SlideTemplate.BigNumber:
            return (
                <>
                    <label>
                        Number
                        <input
                            type="text"
                            value={slide.number}
                            onChange={(e) =>
                                onUpdate({ ...slide, number: e.target.value })
                            }
                            placeholder="e.g. 7.8 billion"
                        />
                    </label>
                    <label>
                        Label
                        <input
                            type="text"
                            value={slide.label}
                            onChange={(e) =>
                                onUpdate({ ...slide, label: e.target.value })
                            }
                            placeholder="e.g. World population"
                        />
                    </label>
                </>
            )

        case SlideTemplate.FullSlideImage:
            return (
                <MediaEditor
                    media={slide.media}
                    onChange={(media) => onUpdate({ ...slide, media })}
                />
            )

        case SlideTemplate.Blank:
            return <p>No options for blank slides.</p>
    }
}
