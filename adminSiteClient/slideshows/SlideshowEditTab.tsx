import { useContext, useState } from "react"
import * as React from "react"
import { match } from "ts-pattern"
import { Button, Select, Upload } from "antd"
import { useQueryClient } from "@tanstack/react-query"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faImages, faUpload } from "@fortawesome/free-solid-svg-icons"
import {
    Slide,
    SlideTemplate,
    SLIDE_TEMPLATE_LABELS,
} from "@ourworldindata/types"
import { RcFile } from "antd/es/upload/interface.js"
import { AdminAppContext } from "../AdminAppContext.js"
import {
    ACCEPTED_IMG_TYPES,
    fileToBase64,
    ImageUploadResponse,
} from "../imagesHelpers.js"
import { ImageSelectorModal } from "../ImageSelectorModal.js"
import { InlineMarkdownEditor, MarkdownEditor } from "../MarkdownEditor.js"

const TEMPLATE_OPTIONS = Object.entries(SLIDE_TEMPLATE_LABELS).map(
    ([value, label]) => ({ value: value as SlideTemplate, label })
)

const POPULAR_TEMPLATES = [
    SlideTemplate.Image,
    SlideTemplate.Chart,
    SlideTemplate.Section,
]

function makeDefaultSlideForTemplate(template: SlideTemplate): Slide {
    return match(template)
        .with(SlideTemplate.Image, (t) => ({
            template: t,
            filename: null as string | null,
        }))
        .with(SlideTemplate.Chart, (t) => ({ template: t, url: "" }))
        .with(SlideTemplate.Section, (t) => ({ template: t, title: "" }))
        .with(SlideTemplate.Cover, (t) => ({ template: t, title: "" }))
        .with(SlideTemplate.Blank, (t) => ({ template: t }))
        .with(SlideTemplate.Quote, (t) => ({ template: t, quote: "" }))
        .with(SlideTemplate.BigNumber, (t) => ({
            template: t,
            number: "",
            label: "",
        }))
        .exhaustive()
}

/** Returns true if the slide has any user-entered content beyond defaults */
function slideHasContent(slide: Slide): boolean {
    return match(slide)
        .with(
            { template: SlideTemplate.Image },
            (s) => s.filename !== null || !!s.slideTitle || !!s.text
        )
        .with(
            { template: SlideTemplate.Chart },
            (s) => !!s.url || !!s.title || !!s.subtitle || !!s.text
        )
        .with(
            { template: SlideTemplate.Section },
            (s) => !!s.title || !!s.subtitle
        )
        .with(
            { template: SlideTemplate.Cover },
            (s) => !!s.title || !!s.subtitle || !!s.author || !!s.date
        )
        .with({ template: SlideTemplate.Blank }, () => false)
        .with(
            { template: SlideTemplate.Quote },
            (s) => !!s.quote || !!s.attribution
        )
        .with(
            { template: SlideTemplate.BigNumber },
            (s) => !!s.number || !!s.label
        )
        .exhaustive()
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

/** Match full OWID URLs for grapher, explorer, or multi-dim */
/** Normalize a full or relative OWID URL to a relative path */
function normalizeChartUrl(input: string): string {
    // Strip full URL prefix if present
    return input.replace(/^https?:\/\/[^/]+/, "")
}

function ChartEditor(props: {
    url: string
    onChange: (url: string) => void
}): React.ReactElement {
    const { url, onChange } = props

    return (
        <div className="SlideshowEditTab__media-editor">
            <label>
                Chart URL:
                <input
                    type="text"
                    value={url}
                    onChange={(e) =>
                        onChange(normalizeChartUrl(e.target.value))
                    }
                    placeholder="/grapher/life-expectancy or paste a full URL"
                />
            </label>
        </div>
    )
}

// --- Template options ---

function HideLogoCheckbox(props: {
    slide: Slide
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props
    return (
        <label>
            <input
                type="checkbox"
                checked={!!slide.hideLogo}
                onChange={(e) =>
                    onUpdate({
                        ...slide,
                        hideLogo: e.target.checked || undefined,
                    })
                }
            />{" "}
            Hide OWID logo
        </label>
    )
}

function TemplateOptionsEditor(props: {
    slide: Slide
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props

    return match(slide)
        .with({ template: SlideTemplate.Image }, (slide) => (
            <>
                <ImageEditor
                    filename={slide.filename}
                    onChange={(filename) => onUpdate({ ...slide, filename })}
                />
                <label>
                    Slide title
                    <InlineMarkdownEditor
                        value={slide.slideTitle ?? ""}
                        onChange={(e) =>
                            onUpdate({
                                ...slide,
                                slideTitle: e || undefined,
                            })
                        }
                        placeholder="Slide title"
                    />
                </label>
                <label>
                    Text (optional)
                    <MarkdownEditor
                        value={slide.text ?? ""}
                        onChange={(text) =>
                            onUpdate({
                                ...slide,
                                text: text || undefined,
                            })
                        }
                        placeholder="Text displayed beside the image"
                    />
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Chart }, (slide) => (
            <>
                <ChartEditor
                    url={slide.url}
                    onChange={(url) => onUpdate({ ...slide, url })}
                />
                <label>
                    Title
                    <InlineMarkdownEditor
                        value={slide.title ?? ""}
                        onChange={(text) =>
                            onUpdate({
                                ...slide,
                                title: text || undefined,
                            })
                        }
                        placeholder="Slide title"
                    />
                </label>
                <label>
                    Subtitle
                    <InlineMarkdownEditor
                        value={slide.subtitle ?? ""}
                        onChange={(text) =>
                            onUpdate({
                                ...slide,
                                subtitle: text || undefined,
                            })
                        }
                        placeholder="Slide subtitle"
                    />
                </label>
                <label>
                    Text (optional)
                    <MarkdownEditor
                        value={slide.text ?? ""}
                        onChange={(text) =>
                            onUpdate({
                                ...slide,
                                text: text || undefined,
                            })
                        }
                        placeholder="Text displayed beside the chart"
                    />
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Section }, (slide) => (
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
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Cover }, (slide) => (
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
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Quote }, (slide) => (
            <>
                <label>
                    Quote
                    <MarkdownEditor
                        value={slide.quote}
                        onChange={(quote) => onUpdate({ ...slide, quote })}
                        placeholder="Supports **bold** and *italics*"
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
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.BigNumber }, (slide) => (
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
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Blank }, (slide) => (
            <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
        ))
        .exhaustive()
}
