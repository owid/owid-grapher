import { useContext, useMemo, useState } from "react"
import * as React from "react"
import { AutoComplete, Button, Select, Upload } from "antd"
import { useQueryClient } from "@tanstack/react-query"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faImages, faUpload } from "@fortawesome/free-solid-svg-icons"
import {
    Slide,
    SlideTemplate,
    SLIDE_TEMPLATE_LABELS,
} from "@ourworldindata/types"
import { RcFile } from "antd/es/upload/interface.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    ACCEPTED_IMG_TYPES,
    fileToBase64,
    ImageUploadResponse,
} from "./imagesHelpers.js"
import { ImageSelectorModal } from "./ImageSelectorModal.js"
import { useGrapherSlugs } from "./useGrapherSlugs.js"

const TEMPLATE_OPTIONS = Object.entries(SLIDE_TEMPLATE_LABELS).map(
    ([value, label]) => ({ value: value as SlideTemplate, label })
)

const POPULAR_TEMPLATES = [
    SlideTemplate.Image,
    SlideTemplate.Chart,
    SlideTemplate.Section,
]

function makeDefaultSlideForTemplate(template: SlideTemplate): Slide {
    switch (template) {
        case SlideTemplate.Image:
            return { template, filename: null }
        case SlideTemplate.Chart:
            return { template, slug: "" }
        case SlideTemplate.Section:
            return { template, title: "" }
        case SlideTemplate.Cover:
            return { template, title: "" }
        case SlideTemplate.Blank:
            return { template }
        case SlideTemplate.Quote:
            return { template, quote: "" }
        case SlideTemplate.BigNumber:
            return { template, number: "", label: "" }
    }
}

/** Returns true if the slide has any user-entered content beyond defaults */
function slideHasContent(slide: Slide): boolean {
    switch (slide.template) {
        case SlideTemplate.Image:
            return (
                slide.filename !== null ||
                !!slide.sectionTitle ||
                !!slide.slideTitle
            )
        case SlideTemplate.Chart:
            return (
                !!slide.slug ||
                !!slide.queryString ||
                !!slide.sectionTitle ||
                !!slide.slideTitle
            )
        case SlideTemplate.Section:
            return !!slide.title || !!slide.subtitle
        case SlideTemplate.Cover:
            return (
                !!slide.title ||
                !!slide.subtitle ||
                !!slide.author ||
                !!slide.date
            )
        case SlideTemplate.Blank:
            return false
        case SlideTemplate.Quote:
            return !!slide.quote || !!slide.attribution
        case SlideTemplate.BigNumber:
            return !!slide.number || !!slide.label
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

// --- Image editor ---

function ImageEditor(props: {
    filename: string | null
    onChange: (filename: string | null) => void
}): React.ReactElement {
    const { filename, onChange } = props
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
                                onChange(response.image.filename)
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
                {filename && (
                    <span className="SlideshowEditTab__media-selected-filename">
                        {filename}
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
                onSelect={(selected) => {
                    onChange(selected)
                    setIsImageSelectorOpen(false)
                }}
                onCancel={() => setIsImageSelectorOpen(false)}
            />
        </div>
    )
}

// --- Chart editor ---

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

function ChartEditor(props: {
    slug: string
    queryString?: string
    onChange: (slug: string, queryString?: string) => void
}): React.ReactElement {
    const { slug, queryString, onChange } = props

    const { data: grapherSlugs = [] } = useGrapherSlugs()

    const [searchText, setSearchText] = useState(slug)

    // Keep search text in sync when the committed slug changes
    // externally (e.g. navigating between slides).
    const prevSlugRef = React.useRef(slug)
    if (prevSlugRef.current !== slug) {
        prevSlugRef.current = slug
        setSearchText(slug)
    }

    const options = useMemo(() => {
        if (!searchText) return []
        const term = searchText.toLowerCase()
        return grapherSlugs
            .filter((s) => s.toLowerCase().includes(term))
            .sort((a, b) => a.length - b.length)
            .slice(0, 50)
            .map((s) => ({ value: s, label: s }))
    }, [grapherSlugs, searchText])

    const handleSearch = (text: string): void => {
        setSearchText(text)
        if (!text) {
            onChange("")
            return
        }
        // If user pastes a full URL, commit immediately
        const parsed = parseGrapherUrl(text)
        if (parsed) {
            setSearchText(parsed.slug)
            onChange(parsed.slug, parsed.queryString)
        }
    }

    const handleSelect = (selected: string): void => {
        setSearchText(selected)
        // Clear queryString when selecting a new slug
        onChange(selected)
    }

    return (
        <div className="SlideshowEditTab__media-editor">
            <label>
                Grapher chart:
                <AutoComplete
                    value={searchText}
                    options={options}
                    onSearch={handleSearch}
                    onSelect={handleSelect}
                    placeholder="Search by slug or paste a full grapher URL..."
                    style={{ width: "100%" }}
                />
            </label>
            {slug && queryString && (
                <p className="SlideshowEditTab__query-string-display">
                    {queryString}
                </p>
            )}
        </div>
    )
}

// --- Template options ---

function TemplateOptionsEditor(props: {
    slide: Slide
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props

    switch (slide.template) {
        case SlideTemplate.Image:
            return (
                <>
                    <ImageEditor
                        filename={slide.filename}
                        onChange={(filename) =>
                            onUpdate({ ...slide, filename })
                        }
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

        case SlideTemplate.Chart:
            return (
                <>
                    <ChartEditor
                        slug={slide.slug}
                        queryString={slide.queryString}
                        onChange={(slug, queryString) =>
                            onUpdate({ ...slide, slug, queryString })
                        }
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

        case SlideTemplate.Cover:
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

        case SlideTemplate.Blank:
            return <p>No options for blank slides.</p>
    }
}
