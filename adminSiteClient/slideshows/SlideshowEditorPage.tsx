import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import { useHistory } from "react-router-dom"
import cx from "classnames"
import { Button, Dropdown, Popconfirm, Tabs, Tooltip } from "antd"
import type { MenuProps } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faPlus,
    faClone,
    faTrash,
    faChevronLeft,
    faChevronRight,
    faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons"
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
import { SlideChartEmbed } from "./chartRendering/SlideChartEmbed.js"
import { SlideLogo } from "../../site/slideshows/SlideLogo.js"

function updateSlideUrl(
    slides: Slide[],
    slideIndex: number,
    urlField: "url" | "url1" | "url2",
    queryString: string
): Slide[] {
    const slide = slides[slideIndex]
    if (!slide) return slides
    const currentUrl = slide[urlField as keyof typeof slide]
    if (typeof currentUrl !== "string") return slides

    const parsed = Url.fromURL(currentUrl)
    const newUrl = `${parsed.originAndPath ?? ""}${queryString}${parsed.hash}`
    if (currentUrl === newUrl) return slides

    const next = [...slides]
    next[slideIndex] = { ...slide, [urlField]: newUrl }
    return next
}

function getSlideChartUrls(slide?: Slide): string[] {
    if (!slide) return []
    if (slide.template === SlideTemplate.Chart) return [slide.url]
    if (slide.template === SlideTemplate.TwoCharts)
        return [slide.url1, slide.url2]
    return []
}

function haveSlideChartUrlsChanged(
    previousSlide: Slide | undefined,
    nextSlide: Slide
): boolean {
    const previousUrls = getSlideChartUrls(previousSlide)
    const nextUrls = getSlideChartUrls(nextSlide)
    if (previousUrls.length !== nextUrls.length) return true
    return previousUrls.some((url, index) => url !== nextUrls[index])
}

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
    const [isPublished, setIsPublished] = useState(false)
    const [interactiveCharts, setInteractiveCharts] = useState(false)
    const [chartApplyVersion, setChartApplyVersion] = useState(0)

    const bumpChartApplyVersion = useCallback(() => {
        setChartApplyVersion((version) => version + 1)
    }, [])

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
            setIsPublished(Boolean(slideshow.isPublished))
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
            if (
                haveSlideChartUrlsChanged(
                    slides[currentSlideIndex],
                    updatedSlide
                )
            ) {
                bumpChartApplyVersion()
            }
            setSlides((prev) => {
                const next = [...prev]
                next[currentSlideIndex] = updatedSlide
                return next
            })
            setIsDirty(true)
        },
        [bumpChartApplyVersion, currentSlideIndex, slides]
    )

    const selectSlide = useCallback(
        (index: number) => {
            if (index === currentSlideIndex) return
            setCurrentSlideIndex(index)
            bumpChartApplyVersion()
        },
        [bumpChartApplyVersion, currentSlideIndex]
    )

    const makeQueryStringChangeHandler = useCallback(
        (urlField: "url" | "url1" | "url2") => (queryString: string) => {
            setSlides((prev) =>
                updateSlideUrl(prev, currentSlideIndex, urlField, queryString)
            )
            setIsDirty(true)
        },
        [currentSlideIndex]
    )

    const handleGrapherQueryStringChange = useMemo(
        () => makeQueryStringChangeHandler("url"),
        [makeQueryStringChangeHandler]
    )
    const handleChart1QueryStringChange = useMemo(
        () => makeQueryStringChangeHandler("url1"),
        [makeQueryStringChangeHandler]
    )
    const handleChart2QueryStringChange = useMemo(
        () => makeQueryStringChangeHandler("url2"),
        [makeQueryStringChangeHandler]
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
            setCurrentSlideIndex(currentSlideIndex + 1)
            bumpChartApplyVersion()
            setIsDirty(true)
        },
        [bumpChartApplyVersion, currentSlideIndex]
    )

    const duplicateSlide = useCallback(() => {
        setSlides((prev) => {
            const next = [...prev]
            next.splice(currentSlideIndex + 1, 0, {
                ...prev[currentSlideIndex],
            })
            return next
        })
        setCurrentSlideIndex(currentSlideIndex + 1)
        bumpChartApplyVersion()
        setIsDirty(true)
    }, [bumpChartApplyVersion, currentSlideIndex])

    const deleteSlide = useCallback(() => {
        if (slides.length <= 1) return
        setSlides((prev) => prev.filter((_, i) => i !== currentSlideIndex))
        setCurrentSlideIndex(Math.min(currentSlideIndex, slides.length - 2))
        bumpChartApplyVersion()
        setIsDirty(true)
    }, [bumpChartApplyVersion, currentSlideIndex, slides.length])

    const save = useCallback(
        async (opts?: { publish?: boolean }) => {
            const config: SlideshowConfig = {
                slides,
                authors: authors || undefined,
                interactiveCharts: interactiveCharts || undefined,
            }
            const shouldPublish = opts?.publish || isPublished
            const payload = {
                slug,
                title,
                config,
                isPublished: shouldPublish,
            }
            if (isCreate) {
                const res = await admin.requestJSON<{
                    success: boolean
                    slideshowId: number
                }>("/api/slideshows", payload, "POST")
                if (res.success) {
                    if (shouldPublish) setIsPublished(true)
                    setIsDirty(false)
                    history.push(`/slideshows/${res.slideshowId}/edit`)
                }
            } else {
                await admin.requestJSON(
                    `/api/slideshows/${props.slideshowId}`,
                    payload,
                    "PUT"
                )
                if (shouldPublish) setIsPublished(true)
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

    const unpublish = useCallback(async () => {
        if (isCreate || !props.slideshowId) return
        await admin.requestJSON(
            `/api/slideshows/${props.slideshowId}`,
            { isPublished: false },
            "PUT"
        )
        setIsPublished(false)
    }, [admin, isCreate, props.slideshowId])

    const deleteSlideshow = useCallback(async () => {
        if (isCreate || !props.slideshowId) return
        await admin.requestJSON(
            `/api/slideshows/${props.slideshowId}`,
            {},
            "DELETE"
        )
        history.push("/slideshows")
    }, [admin, isCreate, props.slideshowId, history])

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
                    onReorder={(nextSlides) => {
                        setSlides(nextSlides)
                        bumpChartApplyVersion()
                    }}
                    onSelect={selectSlide}
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
                    <div
                        className={cx("slide-editor__canvas", {
                            "slide-editor__canvas--cover":
                                currentSlide?.template === SlideTemplate.Cover,
                        })}
                    >
                        {currentSlide && (
                            <SlideRenderer
                                slide={currentSlide}
                                imageMetadata={imageMetadata}
                                renderChart={(url) => {
                                    const isTwoCharts =
                                        currentSlide.template ===
                                        SlideTemplate.TwoCharts
                                    // Determine which query string handler to use
                                    const qsHandler = isTwoCharts
                                        ? url === currentSlide.url2
                                            ? handleChart2QueryStringChange
                                            : handleChart1QueryStringChange
                                        : handleGrapherQueryStringChange
                                    return (
                                        <SlideChartEmbed
                                            url={url}
                                            onQueryStringChange={qsHandler}
                                            chartApplyVersion={
                                                chartApplyVersion
                                            }
                                            interactiveCharts={true}
                                            onChartReady={
                                                isTwoCharts
                                                    ? undefined
                                                    : handleChartReady
                                            }
                                        />
                                    )
                                }}
                            />
                        )}
                        {currentSlide.template === SlideTemplate.Cover && (
                            <SlideLogo coverSlideLogo />
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
                        {!isCreate && (
                            <a
                                href={`/admin/slideshows/${props.slideshowId}/preview`}
                                target="_blank"
                                rel="noopener"
                            >
                                <Button
                                    icon={
                                        <FontAwesomeIcon
                                            icon={faExternalLinkAlt}
                                        />
                                    }
                                >
                                    Preview
                                </Button>
                            </a>
                        )}
                        {!isCreate && isPublished && (
                            <Popconfirm
                                title="Are you sure you want to unpublish this slideshow?"
                                onConfirm={unpublish}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button>Unpublish</Button>
                            </Popconfirm>
                        )}
                        {!isCreate && (
                            <Popconfirm
                                title="Are you sure you want to delete this slideshow? This cannot be undone."
                                onConfirm={deleteSlideshow}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button danger>Delete</Button>
                            </Popconfirm>
                        )}
                    </div>

                    <div className="SlideshowEditorPage__slide-strip">
                        <Button
                            size="small"
                            disabled={currentSlideIndex === 0}
                            onClick={() =>
                                selectSlide(Math.max(0, currentSlideIndex - 1))
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
                                    onClick={() => selectSlide(i)}
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
                                selectSlide(
                                    Math.min(
                                        slides.length - 1,
                                        currentSlideIndex + 1
                                    )
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
                        <Popconfirm
                            title="Are you sure you want to delete this slide?"
                            onConfirm={deleteSlide}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button
                                size="small"
                                danger
                                disabled={slides.length <= 1}
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </Button>
                        </Popconfirm>
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
