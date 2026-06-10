import { useContext, useState } from "react"
import * as React from "react"
import { match } from "ts-pattern"
import { Button, Upload } from "antd"
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

export function SlideshowEditTab(props: {
    slide: Slide
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props

    return (
        <div className="SlideshowEditTab">
            <fieldset>
                <legend>{SLIDE_TEMPLATE_LABELS[slide.template]} options</legend>
                <TemplateOptionsEditor slide={slide} onUpdate={onUpdate} />
            </fieldset>
        </div>
    )
}

const TEXTAREA_PLACEHOLDERS = {
    text: "Supports **bold**, *italics*, lists, and {#f00f00: coloured text}",
    title: "Supports **bold** and *italics*",
    subtitle: "Supports **bold** and *italics*",
    author: "Author name (optional)",
    date: "Date (optional)",
    attribution: "Attribution (optional)",
    contents: "- **Bold the active item**\n- Unbolded items will be light grey",
    chartUrl: "/grapher/slug or paste a full URL",
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
                            type="button"
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

function BlueBackgroundCheckbox(props: {
    slide: Exclude<Slide, { template: SlideTemplate.Cover }>
    onUpdate: (slide: Slide) => void
}): React.ReactElement {
    const { slide, onUpdate } = props
    return (
        <label>
            <input
                type="checkbox"
                checked={!!slide.blueBackground}
                onChange={(e) =>
                    onUpdate({
                        ...slide,
                        blueBackground: e.target.checked || undefined,
                    })
                }
            />{" "}
            Dark background
        </label>
    )
}

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
                        placeholder={TEXTAREA_PLACEHOLDERS.title}
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
                        placeholder={TEXTAREA_PLACEHOLDERS.text}
                    />
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={!!slide.largeText}
                        onChange={(e) =>
                            onUpdate({
                                ...slide,
                                largeText: e.target.checked || undefined,
                            })
                        }
                    />{" "}
                    Large text
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
                <BlueBackgroundCheckbox slide={slide} onUpdate={onUpdate} />
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
                        placeholder={TEXTAREA_PLACEHOLDERS.title}
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
                        placeholder={TEXTAREA_PLACEHOLDERS.subtitle}
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
                        placeholder={TEXTAREA_PLACEHOLDERS.text}
                    />
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={!!slide.largeText}
                        onChange={(e) =>
                            onUpdate({
                                ...slide,
                                largeText: e.target.checked || undefined,
                            })
                        }
                    />{" "}
                    Large text
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
                <BlueBackgroundCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Cover }, (slide) => (
            <>
                <label>
                    Title
                    <InlineMarkdownEditor
                        value={slide.title}
                        onChange={(text) => onUpdate({ ...slide, title: text })}
                        placeholder={TEXTAREA_PLACEHOLDERS.title}
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
                        placeholder={TEXTAREA_PLACEHOLDERS.subtitle}
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
                        placeholder={TEXTAREA_PLACEHOLDERS.author}
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
                        placeholder={TEXTAREA_PLACEHOLDERS.date}
                    />
                </label>
            </>
        ))
        .with({ template: SlideTemplate.Statement }, (slide) => (
            <>
                <label>
                    Statement
                    <MarkdownEditor
                        value={slide.text}
                        onChange={(text) => onUpdate({ ...slide, text })}
                        placeholder="A big statement or key message"
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
                        placeholder={TEXTAREA_PLACEHOLDERS.attribution}
                    />
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
                <BlueBackgroundCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Outline }, (slide) => (
            <>
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
                        placeholder={TEXTAREA_PLACEHOLDERS.title}
                    />
                </label>
                <label>
                    Items (markdown list)
                    <MarkdownEditor
                        value={slide.text}
                        onChange={(text) => onUpdate({ ...slide, text })}
                        placeholder={TEXTAREA_PLACEHOLDERS.contents}
                    />
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
                <BlueBackgroundCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.Text }, (slide) => (
            <>
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
                        placeholder={TEXTAREA_PLACEHOLDERS.title}
                    />
                </label>
                <label>
                    Body text
                    <MarkdownEditor
                        value={slide.text}
                        onChange={(text) => onUpdate({ ...slide, text })}
                        placeholder={TEXTAREA_PLACEHOLDERS.text}
                    />
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={!!slide.largeText}
                        onChange={(e) =>
                            onUpdate({
                                ...slide,
                                largeText: e.target.checked || undefined,
                            })
                        }
                    />{" "}
                    Large text
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
                <BlueBackgroundCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .with({ template: SlideTemplate.TwoCharts }, (slide) => (
            <>
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
                        placeholder={TEXTAREA_PLACEHOLDERS.title}
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
                        placeholder={TEXTAREA_PLACEHOLDERS.subtitle}
                    />
                </label>
                <label>
                    Chart 1 URL
                    <input
                        type="text"
                        value={slide.url1}
                        onChange={(e) =>
                            onUpdate({
                                ...slide,
                                url1: normalizeChartUrl(e.target.value),
                            })
                        }
                        placeholder={TEXTAREA_PLACEHOLDERS.chartUrl}
                    />
                </label>
                <label>
                    Chart 2 URL
                    <input
                        type="text"
                        value={slide.url2}
                        onChange={(e) =>
                            onUpdate({
                                ...slide,
                                url2: normalizeChartUrl(e.target.value),
                            })
                        }
                        placeholder={TEXTAREA_PLACEHOLDERS.chartUrl}
                    />
                </label>
                <HideLogoCheckbox slide={slide} onUpdate={onUpdate} />
                <BlueBackgroundCheckbox slide={slide} onUpdate={onUpdate} />
            </>
        ))
        .exhaustive()
}
