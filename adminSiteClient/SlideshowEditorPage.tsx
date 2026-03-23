import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import * as React from "react"
import { Button, Tabs } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faPlus,
    faClone,
    faTrash,
    faChevronLeft,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons"
import { GrapherState } from "@ourworldindata/grapher"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    DbPlainSlideshow,
    Slide,
    SlideMedia,
    SlideTemplate,
    SlideshowConfig,
} from "@ourworldindata/types"
import { slugify } from "@ourworldindata/utils"
import { SlideshowEditTab } from "./SlideshowEditTab.js"
import { SlideshowArrangeTab } from "./SlideshowArrangeTab.js"
import { SlideshowPreviewTab } from "./SlideshowPreviewTab.js"
import { makeImageSrc } from "./imagesHelpers.js"
import { useImages } from "./useImages.js"
import { SlideGrapher } from "./SlideGrapher.js"
import { SlideRenderer } from "../site/SlideRenderer.js"

import "./SlideshowEditorPage.scss"

function makeDefaultSlide(): Slide {
    return {
        template: SlideTemplate.ImageChartOnly,
        media: null,
    }
}

export function SlideshowEditorPage(props: {
    slideshowId?: number
}): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const isCreate = props.slideshowId === undefined

    const [title, setTitle] = useState("")
    const [slug, setSlug] = useState("")
    const [slugIsCustom, setSlugIsCustom] = useState(false)
    const [slides, setSlides] = useState<Slide[]>([makeDefaultSlide()])
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
    const [isDirty, setIsDirty] = useState(false)
    const [isPublished, setIsPublished] = useState(0)

    const { data: images = [] } = useImages()
    const imageCloudflareIds = useMemo(() => {
        const map = new Map<string, string>()
        for (const img of images) {
            map.set(img.filename, img.cloudflareId)
        }
        return map
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
                if (!slide || !("media" in slide) || !slide.media) return prev
                if (slide.media.type !== "grapher") return prev
                if ((slide.media.queryString ?? "") === queryString) return prev
                const next = [...prev]
                next[currentSlideIndex] = {
                    ...slide,
                    media: {
                        ...slide.media,
                        queryString: queryString || undefined,
                    },
                }
                return next
            })
            setIsDirty(true)
        },
        [currentSlideIndex]
    )

    const addSlide = useCallback(() => {
        const newSlide = makeDefaultSlide()
        setSlides((prev) => {
            const next = [...prev]
            next.splice(currentSlideIndex + 1, 0, newSlide)
            return next
        })
        setCurrentSlideIndex((prev) => prev + 1)
        setIsDirty(true)
    }, [currentSlideIndex])

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

    const save = useCallback(async () => {
        const config: SlideshowConfig = { slides }
        if (isCreate) {
            const res = await admin.requestJSON<{
                success: boolean
                slideshowId: number
            }>("/api/slideshows", { slug, title, config }, "POST")
            if (res.success) {
                window.location.href = `/admin/slideshows/${res.slideshowId}/edit`
            }
        } else {
            await admin.requestJSON(
                `/api/slideshows/${props.slideshowId}`,
                { slug, title, config },
                "PUT"
            )
            setIsDirty(false)
        }
    }, [admin, isCreate, props.slideshowId, slug, title, slides])

    const publish = useCallback(async () => {
        const config: SlideshowConfig = { slides }
        if (isCreate) {
            const res = await admin.requestJSON<{
                success: boolean
                slideshowId: number
            }>(
                "/api/slideshows",
                { slug, title, config, isPublished: 1 },
                "POST"
            )
            if (res.success) {
                window.location.href = `/admin/slideshows/${res.slideshowId}/edit`
            }
        } else {
            await admin.requestJSON(
                `/api/slideshows/${props.slideshowId}`,
                { slug, title, config, isPublished: 1 },
                "PUT"
            )
            setIsPublished(1)
            setIsDirty(false)
        }
    }, [admin, isCreate, props.slideshowId, slug, title, slides])

    const canSave = slug.trim().length > 0 && title.trim().length > 0

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
        {
            key: "preview",
            label: "Preview",
            children: <SlideshowPreviewTab slides={slides} />,
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
                </div>

                <div className="SlideshowEditorPage__body">
                    <div className="SlideshowEditorPage__sidebar">
                        <Tabs items={tabItems} />
                    </div>
                    <div className="SlideshowEditorPage__canvas">
                        <div className="SlideshowEditorPage__slide-preview">
                            {currentSlide && (
                                <SlideRenderer
                                    slide={currentSlide}
                                    renderMedia={(media) => (
                                        <AdminMediaRenderer
                                            media={media}
                                            imageCloudflareIds={
                                                imageCloudflareIds
                                            }
                                            grapherStateRef={grapherStateRef}
                                            onGrapherQueryStringChange={
                                                handleGrapherQueryStringChange
                                            }
                                        />
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="SlideshowEditorPage__footer">
                    <div className="SlideshowEditorPage__footer-actions">
                        <Button onClick={save} disabled={!isDirty || !canSave}>
                            Save
                        </Button>
                        <Button
                            type="primary"
                            onClick={publish}
                            disabled={
                                !canSave || (isPublished === 1 && !isDirty)
                            }
                        >
                            {isPublished ? "Update & Publish" : "Publish"}
                        </Button>
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
                        <Button size="small" onClick={addSlide}>
                            <FontAwesomeIcon icon={faPlus} />
                        </Button>
                    </div>
                </div>
            </main>
        </AdminLayout>
    )
}

/**
 * Admin-specific media renderer that uses SlideGrapher for grapher
 * slides (with MobX sync) and Cloudflare image URLs for images.
 * Passed to SlideRenderer via the renderMedia prop.
 */
function AdminMediaRenderer(props: {
    media: SlideMedia
    imageCloudflareIds: Map<string, string>
    grapherStateRef: React.RefObject<GrapherState | null>
    onGrapherQueryStringChange?: (queryString: string) => void
}): React.ReactElement {
    const {
        media,
        imageCloudflareIds,
        grapherStateRef,
        onGrapherQueryStringChange,
    } = props

    if (media.type === "image") {
        const cloudflareId = imageCloudflareIds.get(media.filename)
        if (cloudflareId) {
            return (
                <img
                    src={makeImageSrc(cloudflareId, 960)}
                    alt={media.filename}
                    className="SlidePreview__media-image"
                />
            )
        }
        return (
            <div className="SlidePreview__media-placeholder">
                {media.filename}
            </div>
        )
    }

    return (
        <SlideGrapher
            slug={media.slug}
            initialQueryString={media.queryString}
            grapherStateRef={grapherStateRef}
            onQueryStringChange={onGrapherQueryStringChange}
        />
    )
}
