import * as React from "react"
import {
    memo,
    useState,
    useCallback,
    useEffect,
    useMemo,
    ComponentPropsWithRef,
} from "react"
import { useMediaQuery } from "react-responsive"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faArrowRight,
    faCalendarDay,
    faChevronRight,
    faChevronLeft,
} from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import useEmblaCarousel from "embla-carousel-react"
import ClassNames from "embla-carousel-class-names"
import { EmblaCarouselType } from "embla-carousel"

import { Button } from "@ourworldindata/components"
import {
    EnrichedBlockImage,
    OwidEnrichedGdocBlock,
    OwidGdocDataInsightInterface,
    dayjs,
} from "@ourworldindata/utils"
import { dataInsightIndexToIdMap } from "../pages/DataInsight.js"
import Image from "./Image.js"
import { ArticleBlocks } from "./ArticleBlocks.js"

export default function LatestDataInsights({
    className,
    latestDataInsights,
}: {
    className?: string
    latestDataInsights: OwidGdocDataInsightInterface[]
}) {
    const dataInsights = useMemo(
        () =>
            latestDataInsights.map((dataInsight) => {
                return {
                    ...dataInsight,
                    publishedAt: dataInsight.publishedAt
                        ? new Date(dataInsight.publishedAt)
                        : undefined,
                }
            }),
        [latestDataInsights]
    )
    const isSmallScreen = useMediaQuery({ maxWidth: 768 })
    const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start" }, [
        ClassNames(),
    ])
    const { selectedIndex, scrollSnaps, onDotButtonClick } =
        useDotButton(emblaApi)
    const [canScrollPrev, setCanScrollPrev] = useState(false)
    const [canScrollNext, setCanScrollNext] = useState(false)

    const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
        setCanScrollPrev(emblaApi.canScrollPrev())
        setCanScrollNext(emblaApi.canScrollNext())
    }, [])

    useEffect(() => {
        if (!emblaApi) return
        onSelect(emblaApi)
        emblaApi.on("reInit", onSelect).on("select", onSelect)
        return () => {
            emblaApi.off("reInit", onSelect).off("select", onSelect)
        }
    }, [emblaApi, onSelect])

    const scrollPrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev()
    }, [emblaApi])

    const scrollNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext()
    }, [emblaApi])

    return (
        <div className={cx("latest-data-insights", className)}>
            <div className="latest-data-insights__viewport" ref={emblaRef}>
                <div className="latest-data-insights__card-container">
                    {dataInsights.map((dataInsight, index) => (
                        <DataInsightCard
                            key={dataInsight.id}
                            title={dataInsight.content.title}
                            body={dataInsight.content.body}
                            publishedAt={dataInsight.publishedAt}
                            href={`/data-insights#${dataInsightIndexToIdMap[index]}`}
                        />
                    ))}
                    {isSmallScreen && (
                        // Normal way to hide the last slide would be a CSS media
                        // query with `display: none`, but that breaks Embla.
                        <Button
                            className="latest-data-insights__card latest-data-insights__card__see-all body-3-medium"
                            href="/data-insights"
                            text="See all our Daily Data Insights"
                            theme="outline-vermillion"
                        />
                    )}
                </div>
            </div>
            {canScrollPrev && (
                <Button
                    className="latest-data-insights__control-button latest-data-insights__control-button--prev"
                    theme="solid-blue"
                    onClick={scrollPrev}
                    icon={faChevronLeft}
                    text=""
                />
            )}
            {canScrollNext && (
                <Button
                    className="latest-data-insights__control-button latest-data-insights__control-button--next"
                    theme="solid-blue"
                    onClick={scrollNext}
                    icon={faChevronRight}
                    text=""
                />
            )}
            <div className="latest-data-insights__control-dots">
                {scrollSnaps.map((_, index) => (
                    <DotButton
                        key={index}
                        onClick={() => onDotButtonClick(index)}
                        className={cx("latest-data-insights__control-dot", {
                            "latest-data-insights__control-dot--selected":
                                index === selectedIndex,
                        })}
                    />
                ))}
            </div>
        </div>
    )
}

const DataInsightCard = memo(function DataInsightCard({
    title,
    body,
    publishedAt,
    href,
}: {
    title: string
    body: OwidEnrichedGdocBlock[]
    publishedAt?: Date
    href: string
}) {
    const firstImageIndex = body.findIndex((block) => block.type === "image")
    const firstImageBlock = body[firstImageIndex] as
        | EnrichedBlockImage
        | undefined
    const otherBlocks = body.filter((_, index) => index !== firstImageIndex)
    return (
        <a
            className="latest-data-insights__card latest-data-insights__card__data-insight"
            href={href}
        >
            {firstImageBlock && (
                <Image
                    className="latest-data-insights__card-left"
                    filename={firstImageBlock.filename}
                    smallFilename={firstImageBlock.smallFilename}
                    shouldLightbox={false}
                />
            )}
            <div className="latest-data-insights__card-right">
                {publishedAt && <Dateline publishedAt={publishedAt} />}
                <h3 className="latest-data-insights__card-title">{title}</h3>
                <div className="latest-data-insights__card-body">
                    <ArticleBlocks blocks={otherBlocks} renderLinks={false} />
                </div>
                <div className="latest-data-insights__card-continue">
                    <span className="body-3-medium-underlined">
                        Continue reading
                    </span>{" "}
                    <FontAwesomeIcon
                        icon={faArrowRight}
                        style={{ fontSize: "10px" }}
                    />
                </div>
            </div>
        </a>
    )
})

function Dateline({ publishedAt }: { publishedAt: Date }) {
    const date = dayjs(publishedAt)
    let formattedDate
    let className
    if (date.isToday()) {
        formattedDate = "Today"
        className = "latest-data-insights__card-dateline--is-today"
    } else if (date.isYesterday()) {
        formattedDate = "Yesterday"
    } else {
        formattedDate = publishedAt.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
        })
    }
    return (
        <p
            className={cx(
                "latest-data-insights__card-dateline h5-black-caps",
                className
            )}
        >
            <FontAwesomeIcon icon={faCalendarDay} />
            <span className="latest-data-insights__card-date">
                {formattedDate}
            </span>
        </p>
    )
}

function useDotButton(emblaApi: EmblaCarouselType | undefined): {
    selectedIndex: number
    scrollSnaps: number[]
    onDotButtonClick: (index: number) => void
} {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

    const onDotButtonClick = useCallback(
        (index: number) => {
            if (!emblaApi) return
            emblaApi.scrollTo(index)
        },
        [emblaApi]
    )

    const onInit = useCallback((emblaApi: EmblaCarouselType) => {
        setScrollSnaps(emblaApi.scrollSnapList())
    }, [])

    const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
        setSelectedIndex(emblaApi.selectedScrollSnap())
    }, [])

    useEffect(() => {
        if (!emblaApi) return
        onInit(emblaApi)
        onSelect(emblaApi)
        emblaApi
            .on("reInit", onInit)
            .on("reInit", onSelect)
            .on("select", onSelect)
        return () => {
            emblaApi
                .off("reInit", onInit)
                .off("reInit", onSelect)
                .off("select", onSelect)
        }
    }, [emblaApi, onInit, onSelect])

    return {
        selectedIndex,
        scrollSnaps,
        onDotButtonClick,
    }
}

function DotButton({
    children,
    ...restProps
}: ComponentPropsWithRef<"button">) {
    return (
        <button type="button" {...restProps}>
            {children}
        </button>
    )
}
