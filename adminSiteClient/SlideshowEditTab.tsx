import { useContext, useMemo, useState } from "react"
import * as React from "react"
import { AutoComplete, Button, Select, Upload } from "antd"
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
import { useGrapherSlugs } from "./useGrapherSlugs.js"

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

/** Returns true if the slide has any user-entered content beyond defaults */
function slideHasContent(slide: Slide): boolean {
    switch (slide.template) {
        case SlideTemplate.ImageChartOnly:
            return (
                slide.media !== null ||
                !!slide.sectionTitle ||
                !!slide.slideTitle
            )
        case SlideTemplate.Section:
            return !!slide.title || !!slide.subtitle
        case SlideTemplate.ImageChartWithText:
            return slide.media !== null || !!slide.text
        case SlideTemplate.TitleSlide:
            return (
                !!slide.title ||
                !!slide.subtitle ||
                !!slide.author ||
                !!slide.date
            )
        case SlideTemplate.Blank:
            return false
        case SlideTemplate.TwoColumnText:
            return !!slide.leftText || !!slide.rightText
        case SlideTemplate.Quote:
            return !!slide.quote || !!slide.attribution
        case SlideTemplate.BigNumber:
            return !!slide.number || !!slide.label
        case SlideTemplate.FullSlideImage:
            return slide.media !== null
    }
}

export function SlideshowEditTab(props: {
    slide: Slide
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props

    const handleTemplateChange = (template: SlideTemplate) => {
        if (template === slide.template) return
        if (
            slideHasContent(slide) &&
            !confirm(
                "Changing the template will discard the current slide content. Continue?"
            )
        ) {
            return
        }
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

const GRAPHER_URL_REGEX = /^https?:\/\/[^/]*\/grapher\/([a-z0-9-]+)(\?.*)?$/i

/** Parse a full grapher URL into slug + queryString, or return null */
function parseGrapherUrl(
    input: string
): { slug: string; queryString?: string } | null {
    const match = input.match(GRAPHER_URL_REGEX)
    if (!match) return null
    return {
        slug: match[1],
        queryString: match[2] || undefined,
    }
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

    const { data: grapherSlugs = [] } = useGrapherSlugs()

    // Local search text for the autocomplete — only committed to
    // the slide data model when the user selects from the dropdown
    // or pastes a full URL. This prevents the Grapher from trying
    // to instantiate on every keystroke.
    const committedSlug = media?.type === "grapher" ? media.slug : ""
    const [grapherSearchText, setGrapherSearchText] = useState(committedSlug)

    // Keep search text in sync when the committed slug changes
    // externally (e.g. navigating between slides).
    const prevCommittedSlugRef = React.useRef(committedSlug)
    if (prevCommittedSlugRef.current !== committedSlug) {
        prevCommittedSlugRef.current = committedSlug
        setGrapherSearchText(committedSlug)
    }

    const grapherQueryString =
        media?.type === "grapher" ? (media.queryString ?? "") : ""

    const grapherOptions = useMemo(() => {
        if (!grapherSearchText) return []
        const term = grapherSearchText.toLowerCase()
        return grapherSlugs
            .filter((slug) => slug.toLowerCase().includes(term))
            .sort((a, b) => a.length - b.length)
            .slice(0, 50)
            .map((slug) => ({
                value: slug,
                label: slug,
            }))
    }, [grapherSlugs, grapherSearchText])

    const handleGrapherSearch = (text: string): void => {
        setGrapherSearchText(text)

        if (!text) {
            onChange(null)
            return
        }

        // If user pastes a full URL, commit immediately
        const parsed = parseGrapherUrl(text)
        if (parsed) {
            setGrapherSearchText(parsed.slug)
            onChange({
                type: "grapher",
                slug: parsed.slug,
                queryString: parsed.queryString,
            })
        }
    }

    const handleGrapherSelect = (slug: string): void => {
        setGrapherSearchText(slug)
        // Always clear queryString when selecting a new slug
        onChange({ type: "grapher", slug })
    }

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
                Grapher chart:
                <AutoComplete
                    value={grapherSearchText}
                    options={grapherOptions}
                    onSearch={handleGrapherSearch}
                    onSelect={handleGrapherSelect}
                    placeholder="Search by slug or paste a full grapher URL..."
                    style={{ width: "100%" }}
                />
            </label>
            {media?.type === "grapher" && media.slug && grapherQueryString && (
                <p className="SlideshowEditTab__query-string-display">
                    {grapherQueryString}
                </p>
            )}
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
