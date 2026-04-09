import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import * as React from "react"
import { useHistory } from "react-router-dom"
import { Button, Dropdown, Tabs, Tooltip } from "antd"
import type { MenuProps } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faPlus,
    faClone,
    faTrash,
    faChevronLeft,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons"
import { GrapherState } from "@ourworldindata/grapher"
import { AdminLayout } from "../AdminLayout.js"
import { AdminAppContext } from "../AdminAppContext.js"
import {
    DbPlainSlideshow,
    ImageMetadata,
    Slide,
    SlideTemplate,
    SLIDE_TEMPLATE_LABELS,
    SlideshowConfig,
} from "@ourworldindata/types"
import { slugify, Url } from "@ourworldindata/utils"
import { toPlaintext } from "@ourworldindata/components"
import { SlideshowEditTab } from "./SlideshowEditTab.js"
import { makeDefaultSlideForTemplate } from "../../site/slideshows/slideshowUtils.js"
import { SlideshowArrangeTab } from "./SlideshowArrangeTab.js"
import { useImages } from "../useImages.js"
import { SlideRenderer } from "../../site/slideshows/SlideRenderer.js"
import { SlideChartEmbed } from "../../site/slideshows/SlideChartEmbed.js"

export function SlideshowEditorPage(props: {
    slideshowId?: number
}): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const history = useHistory()
    const isCreate = props.slideshowId === undefined

    const [title, setTitle] = useState("")
    const [slug, setSlug] = useState("")
    const [slugIsCustom, setSlugIsCustom] = useState(false)
    const [authors, setAuthors] = useState(admin.username)
    const [slides, setSlides] = useState<Slide[]>([
        makeDefaultSlideForTemplate(SlideTemplate.Cover),
    ])
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
    const [isDirty, setIsDirty] = useState(false)
    const [isPublished, setIsPublished] = useState(0)
    const [interactiveCharts, setInteractiveCharts] = useState(false)

    const { data: images = [] } = useImages()
    const imageMetadata = useMemo(() => {
        const record: Record<string, ImageMetadata> = {}
        for (const img of images) {
            record[img.filename] = img
        }
        return record
    }, [images])

    const currentSlide = slides[currentSlideIndex]

    // Load existing slideshow
    useEffect(() => {
        if (isCreate) return
        const load = async () => {
            const res = await admin.getJSON<{
                slideshow: DbPlainSlideshow
            }>(`/api/slideshows/${props.slideshowId}.json`)
            const { slideshow } = res
            setTitle(slideshow.title)
            setSlug(slideshow.slug)
            setSlugIsCustom(true)
            setIsPublished(slideshow.isPublished)
            setAuthors(slideshow.config.authors ?? admin.username)
            setInteractiveCharts(slideshow.config.interactiveCharts ?? false)
            if (slideshow.config.slides.length > 0) {
                setSlides(slideshow.config.slides)
            }
        }
        void load()
    }, [admin, props.slideshowId, isCreate])

    const updateCurrentSlide = useCallback(
        (updatedSlide: Slide) => {
            setSlides((prev) => {
                const next = [...prev]
                next[currentSlideIndex] = updatedSlide
                return next
            })
            setIsDirty(true)
        },
        [currentSlideIndex]
    )

    const grapherStateRef = useRef<GrapherState | null>(null)

    const handleGrapherQueryStringChange = useCallback(
        (queryString: string) => {
            setSlides((prev) => {
                const slide = prev[currentSlideIndex]
                if (!slide || slide.template !== SlideTemplate.Chart)
                    return prev
                // Update the query string portion of the URL,
                // preserving any hash fragment
                const parsed = Url.fromURL(slide.url)
                const basePath = parsed.originAndPath ?? ""
                const hash = parsed.hash
                const newUrl = queryString
                    ? `${basePath}${queryString}${hash}`
                    : `${basePath}${hash}`
                if (slide.url === newUrl) return prev
                const next = [...prev]
                next[currentSlideIndex] = { ...slide, url: newUrl }
                return next
            })
            // SlideGrapher gates its reaction behind when(isReady) and
            // takes a baseline snapshot, so by the time this callback is
            // called, it's a genuine user interaction.
            setIsDirty(true)
        },
        [currentSlideIndex]
    )

    const handleChartReady = useCallback(
        (info: { title: string; subtitle: string }) => {
            setSlides((prev) => {
                const slide = prev[currentSlideIndex]
                if (!slide || slide.template !== SlideTemplate.Chart)
                    return prev
                // Only auto-populate if the fields are empty
                const updates: Partial<typeof slide> = {}
                if (!slide.title && info.title) {
                    updates.title = info.title
                }
                if (!slide.subtitle && info.subtitle) {
                    updates.subtitle = toPlaintext(info.subtitle)
                }
                if (Object.keys(updates).length === 0) return prev
                const next = [...prev]
                next[currentSlideIndex] = { ...slide, ...updates }
                return next
            })
            // Don't set isDirty — this is auto-population, not a user edit
        },
        [currentSlideIndex]
    )

    const addSlide = useCallback(
        (template: SlideTemplate) => {
            const newSlide = makeDefaultSlideForTemplate(template)
            setSlides((prev) => {
                const next = [...prev]
                next.splice(currentSlideIndex + 1, 0, newSlide)
                return next
            })
            setCurrentSlideIndex((prev) => prev + 1)
            setIsDirty(true)
        },
        [currentSlideIndex]
    )

    const duplicateSlide = useCallback(() => {
        setSlides((prev) => {
            const next = [...prev]
            next.splice(currentSlideIndex + 1, 0, {
                ...prev[currentSlideIndex],
            })
            return next
        })
        setCurrentSlideIndex((prev) => prev + 1)
        setIsDirty(true)
    }, [currentSlideIndex])

    const deleteSlide = useCallback(() => {
        if (slides.length <= 1) return
        setSlides((prev) => prev.filter((_, i) => i !== currentSlideIndex))
        setCurrentSlideIndex((prev) => Math.min(prev, slides.length - 2))
        setIsDirty(true)
    }, [currentSlideIndex, slides.length])

    const save = useCallback(
        async (opts?: { publish?: boolean }) => {
            const config: SlideshowConfig = {
                slides,
                authors: authors || undefined,
                interactiveCharts: interactiveCharts || undefined,
            }
            const shouldPublish = opts?.publish || isPublished === 1
            const payload = {
                slug,
                title,
                config,
                ...(shouldPublish ? { isPublished: 1 } : {}),
            }
            if (isCreate) {
                const res = await admin.requestJSON<{
                    success: boolean
                    slideshowId: number
                }>("/api/slideshows", payload, "POST")
                if (res.success) {
                    if (shouldPublish) setIsPublished(1)
                    setIsDirty(false)
                    history.push(`/slideshows/${res.slideshowId}/edit`)
                }
            } else {
                await admin.requestJSON(
                    `/api/slideshows/${props.slideshowId}`,
                    payload,
                    "PUT"
                )
                if (shouldPublish) setIsPublished(1)
                setIsDirty(false)
            }
        },
        [
            admin,
            isCreate,
            props.slideshowId,
            slug,
            title,
            authors,
            interactiveCharts,
            slides,
            history,
            isPublished,
        ]
    )

    const canSave = slug.trim().length > 0 && title.trim().length > 0

    const addSlideMenuItems: MenuProps["items"] = Object.entries(
        SLIDE_TEMPLATE_LABELS
    ).map(([value, label]) => ({
        key: value,
        label,
        onClick: () => addSlide(value as SlideTemplate),
    }))

    const tabItems = [
        {
            key: "edit",
            label: "Edit",
            children: currentSlide ? (
                <SlideshowEditTab
                    slide={currentSlide}
                    onUpdate={updateCurrentSlide}
                />
            ) : null,
        },
        {
            key: "arrange",
            label: "Arrange",
            children: (
                <SlideshowArrangeTab
                    slides={slides}
                    currentSlideIndex={currentSlideIndex}
                    onReorder={setSlides}
                    onSelect={setCurrentSlideIndex}
                    onDirty={() => setIsDirty(true)}
                />
            ),
        },
    ]

    return (
        <AdminLayout
            title={isCreate ? "Create slideshow" : `Editing: ${title}`}
        >
            <main className="SlideshowEditorPage">
                <div className="SlideshowEditorPage__header">
                    <label>
                        Title
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => {
                                const newTitle = e.target.value
                                setTitle(newTitle)
                                if (!slugIsCustom) {
                                    setSlug(slugify(newTitle))
                                }
                                setIsDirty(true)
                            }}
                            placeholder="Slideshow title"
                        />
                    </label>
                    <label>
                        Slug
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => {
                                setSlug(e.target.value)
                                setSlugIsCustom(true)
                                setIsDirty(true)
                            }}
                            placeholder="slideshow-slug"
                        />
                    </label>
                    <label>
                        Authors
                        <input
                            type="text"
                            value={authors}
                            onChange={(e) => {
                                setAuthors(e.target.value)
                                setIsDirty(true)
                            }}
                            placeholder="Author name(s)"
                        />
                    </label>
                    <Tooltip title="When enabled, charts show their timeline, tab controls, and download button. When disabled, charts are displayed in a minimal presentation mode.">
                        <label>
                            <input
                                type="checkbox"
                                checked={interactiveCharts}
                                onChange={(e) => {
                                    setInteractiveCharts(e.target.checked)
                                    setIsDirty(true)
                                }}
                            />{" "}
                            Interactive charts
                        </label>
                    </Tooltip>
                </div>

                <div className="SlideshowEditorPage__body">
                    <div className="SlideshowEditorPage__sidebar">
                        <Tabs items={tabItems} />
                    </div>
                    <div className="slide-editor__canvas">
                        {currentSlide && (
                            <SlideRenderer
                                slide={currentSlide}
                                imageMetadata={imageMetadata}
                                renderChart={(url) => (
                                    <SlideChartEmbed
                                        url={url}
                                        grapherStateRef={grapherStateRef}
                                        onQueryStringChange={
                                            handleGrapherQueryStringChange
                                        }
                                        interactiveCharts={true}
                                        onChartReady={handleChartReady}
                                    />
                                )}
                            />
                        )}
                    </div>
                </div>

                <div className="SlideshowEditorPage__footer">
                    <div className="SlideshowEditorPage__footer-actions">
                        {isPublished ? (
                            <Button
                                type="primary"
                                onClick={() => save()}
                                disabled={!isDirty || !canSave}
                            >
                                Save
                            </Button>
                        ) : (
                            <>
                                <Button
                                    onClick={() => save()}
                                    disabled={!isDirty || !canSave}
                                >
                                    Save draft
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={() => save({ publish: true })}
                                    disabled={!canSave}
                                >
                                    Publish
                                </Button>
                            </>
                        )}
                    </div>

                    <div className="SlideshowEditorPage__slide-strip">
                        <Button
                            size="small"
                            disabled={currentSlideIndex === 0}
                            onClick={() =>
                                setCurrentSlideIndex((i) => Math.max(0, i - 1))
                            }
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </Button>

                        <div className="SlideshowEditorPage__slide-thumbnails">
                            {slides.map((slide, i) => (
                                <button
                                    key={i}
                                    className={`SlideshowEditorPage__slide-thumbnail ${
                                        i === currentSlideIndex
                                            ? "SlideshowEditorPage__slide-thumbnail--active"
                                            : ""
                                    }`}
                                    onClick={() => setCurrentSlideIndex(i)}
                                >
                                    <span className="SlideshowEditorPage__slide-thumbnail-label">
                                        {i + 1}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <Button
                            size="small"
                            disabled={currentSlideIndex === slides.length - 1}
                            onClick={() =>
                                setCurrentSlideIndex((i) =>
                                    Math.min(slides.length - 1, i + 1)
                                )
                            }
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </Button>
                    </div>

                    <div className="SlideshowEditorPage__slide-actions">
                        <Button size="small" onClick={duplicateSlide}>
                            <FontAwesomeIcon icon={faClone} />
                        </Button>
                        <Button
                            size="small"
                            danger
                            onClick={deleteSlide}
                            disabled={slides.length <= 1}
                        >
                            <FontAwesomeIcon icon={faTrash} />
                        </Button>
                        <Dropdown
                            menu={{ items: addSlideMenuItems }}
                            trigger={["click"]}
                        >
                            <Button size="small">
                                <FontAwesomeIcon icon={faPlus} />
                            </Button>
                        </Dropdown>
                    </div>
                </div>
            </main>
        </AdminLayout>
    )
}
