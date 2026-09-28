import { useEffect, useRef, type ReactNode } from "react"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SearchResultType } from "@ourworldindata/types"
import { buildSearchHrefForCard } from "../search/searchState.js"
import {
    PerspectiveItem,
    RelatedArticleLink,
    RelatedDataLink,
    type PerspectiveSectionProps,
} from "./PerspectiveItem.js"

export function HorizontalStrip({
    page,
    selectedId,
    onSelect,
}: PerspectiveSectionProps) {
    const itemsRef = useRef<HTMLDivElement>(null)

    // Keep the selected item visible, e.g. when it comes from the URL.
    useEffect(() => {
        const items = itemsRef.current
        const selected = items?.querySelector<HTMLElement>(
            ".perspective[aria-pressed='true']"
        )
        if (!items || !selected) return
        const itemsRect = items.getBoundingClientRect()
        const selectedRect = selected.getBoundingClientRect()
        if (
            selectedRect.left < itemsRect.left ||
            selectedRect.right > itemsRect.right
        ) {
            items.scrollBy({
                left: selectedRect.left - itemsRect.left,
                behavior: "smooth",
            })
        }
    }, [selectedId])

    return (
        <section className="perspectives-strip" aria-label="Data perspectives">
            <div className="perspectives-strip__items" ref={itemsRef}>
                <StripGroup heading={<h2>Interesting views of this chart</h2>}>
                    {page.perspectives.map((perspective) => (
                        <PerspectiveItem
                            key={perspective.id}
                            page={page}
                            perspective={perspective}
                            selected={selectedId === perspective.id}
                            onSelect={onSelect}
                        />
                    ))}
                </StripGroup>
                {page.relatedData && (
                    <StripGroup heading={<h3>Related data</h3>}>
                        {page.relatedData.items.map((item) => (
                            <RelatedDataLink key={item.slug} item={item} />
                        ))}
                        <SeeAllLink
                            href={buildSearchHrefForCard(
                                SearchResultType.DATA,
                                page.relatedData.topic
                            )}
                        >
                            See all our charts on {page.relatedData.topicLabel}
                        </SeeAllLink>
                    </StripGroup>
                )}
                {page.relatedArticles && (
                    <StripGroup heading={<h3>Related articles</h3>}>
                        {page.relatedArticles.items.map((item) => (
                            <RelatedArticleLink
                                key={item.slug}
                                item={item}
                                imageWidth={320}
                            />
                        ))}
                        <SeeAllLink
                            href={buildSearchHrefForCard(
                                SearchResultType.WRITING,
                                page.relatedArticles.topic
                            )}
                        >
                            See all our writing on{" "}
                            {page.relatedArticles.topicLabel}
                        </SeeAllLink>
                    </StripGroup>
                )}
            </div>
        </section>
    )
}

function StripGroup({
    heading,
    children,
}: {
    heading: ReactNode
    children: ReactNode
}) {
    return (
        <section className="perspectives-strip__group">
            <div className="perspectives-strip__header">
                <div className="perspectives-strip__heading">{heading}</div>
            </div>
            <div className="perspectives-strip__cards">{children}</div>
        </section>
    )
}

function SeeAllLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a className="perspectives-strip__see-all" href={href}>
            <span>{children}</span>
            <FontAwesomeIcon icon={faArrowRight} />
        </a>
    )
}
