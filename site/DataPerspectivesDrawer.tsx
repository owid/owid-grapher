import { useState, useEffect, useRef } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronUp, faXmark } from "@fortawesome/free-solid-svg-icons"
import GrapherImage from "./GrapherImage.js"
import { useCookieBannerInset } from "./useCookieBannerInset.js"
import { DataPerspective } from "./dataPerspectivesFixtures.js"
import {
    DataPerspectivesDrawerLayout,
    DataPerspectivesChrome,
    thumbQueryString,
} from "./dataPerspectivesVariant.js"

/**
 * A drawer pinned to the bottom of the screen (`?dpDrawer=…`). Collapsed, it's
 * a slim bar; tapped, it opens to about half the screen, leaving the chart
 * visible behind it.
 *
 *   dpDrawer=perspectives — the data perspectives. Picking one updates the
 *       chart behind the drawer and the drawer closes, so you see the result.
 *       This replaces any inline perspectives array.
 *   dpDrawer=related — related data pages and related writing instead. This
 *       sits alongside any dpLayout (e.g. pageswipe for perspectives, the
 *       drawer for where to go next).
 *   dpDrawer=metadata — the metadata box, fully expanded, moved out of the
 *       page and into the drawer.
 *
 * `dpDrawerLayout=vertical|horizontal` sets how the items are arranged.
 */

export interface DrawerLink {
    title: string
    url: string
    /** A data page's slug (for a chart thumbnail) — or an article image. */
    slug?: string
    imageUrl?: string
}

export function DataPerspectivesDrawer({
    mode,
    layout,
    chrome,
    slug,
    perspectives,
    relatedPages,
    relatedArticles,
    onSelect,
    metadataSlot,
}: {
    mode: "perspectives" | "related" | "metadata"
    layout: DataPerspectivesDrawerLayout
    chrome: DataPerspectivesChrome
    slug: string
    perspectives: DataPerspective[]
    relatedPages: DrawerLink[]
    relatedArticles: DrawerLink[]
    onSelect: (index: number) => void
    /** The metadata box, for dpDrawer=metadata. */
    metadataSlot?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<number | null>(null)
    // Sit above the cookie banner while it's open (it covers the bottom of the
    // screen at a far higher z-index), and never grow taller than the space
    // that leaves.
    const bannerInset = useCookieBannerInset()

    // In the drawer the metadata box shows its expanded view outright: open its
    // <details> once it's mounted (the show-more/less toggle is hidden by CSS).
    const metadataRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        if (!open || mode !== "metadata") return
        metadataRef.current
            ?.querySelectorAll<HTMLDetailsElement>(
                ".metadata-box-expander__details"
            )
            .forEach((details) => (details.open = true))
    }, [open, mode])

    // Escape closes it, as with any sheet.
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open])

    const count =
        mode === "perspectives"
            ? perspectives.length
            : mode === "related"
              ? relatedPages.length + relatedArticles.length
              : undefined
    if (count === 0 || (mode === "metadata" && !metadataSlot)) return null

    const label =
        mode === "perspectives"
            ? "Data perspectives"
            : mode === "related"
              ? "Related data & writing"
              : "About this data"

    const pick = (index: number) => {
        setSelected(index)
        onSelect(index)
        // Close so the reader sees the chart change behind it.
        setOpen(false)
    }

    return (
        <>
            {open && (
                <div
                    className="dp-drawer__backdrop"
                    onClick={() => setOpen(false)}
                    aria-hidden
                />
            )}
            <div
                className={cx("dp-drawer", {
                    "dp-drawer--open": open,
                })}
                style={{
                    bottom: bannerInset,
                    maxHeight: `min(56vh, calc(100vh - ${bannerInset}px - 80px))`,
                    height: open
                        ? `min(56vh, calc(100vh - ${bannerInset}px - 80px))`
                        : undefined,
                }}
                role={open ? "dialog" : undefined}
                aria-label={label}
            >
                <button
                    type="button"
                    className="dp-drawer__handle"
                    aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}
                >
                    <span className="dp-drawer__grabber" aria-hidden />
                    <span className="dp-drawer__handle-row">
                        <span className="dp-drawer__label">
                            {label}
                            {count !== undefined && (
                                <span className="dp-drawer__count">
                                    {count}
                                </span>
                            )}
                        </span>
                        <FontAwesomeIcon
                            icon={open ? faXmark : faChevronUp}
                            className="dp-drawer__toggle-icon"
                        />
                    </span>
                </button>

                {open && (
                    <div
                        className={cx(
                            "dp-drawer__body",
                            `dp-drawer__body--${layout}`
                        )}
                    >
                        {mode === "metadata" ? (
                            <div
                                className="dp-drawer__metadata"
                                ref={metadataRef}
                            >
                                {metadataSlot}
                            </div>
                        ) : mode === "perspectives" ? (
                            <ol className="dp-drawer__list">
                                {perspectives.map((p, i) => (
                                    <li key={p.queryParams}>
                                        <button
                                            type="button"
                                            className={cx("dp-drawer__item", {
                                                "dp-drawer__item--selected":
                                                    selected === i,
                                            })}
                                            aria-current={
                                                selected === i || undefined
                                            }
                                            onClick={() => pick(i)}
                                        >
                                            <span className="dp-drawer__thumb">
                                                <GrapherImage
                                                    slug={slug}
                                                    queryString={thumbQueryString(
                                                        p.queryParams,
                                                        chrome
                                                    )}
                                                    alt={p.title ?? ""}
                                                    noFormatting
                                                />
                                            </span>
                                            <span className="dp-drawer__item-text">
                                                <span className="dp-drawer__item-title">
                                                    {p.title ??
                                                        "Another view of this data"}
                                                </span>
                                                {p.text && (
                                                    <span className="dp-drawer__item-desc">
                                                        {p.text}
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <>
                                <RelatedSection
                                    heading="Related data"
                                    links={relatedPages}
                                    chrome={chrome}
                                />
                                <RelatedSection
                                    heading="Related research & writing"
                                    links={relatedArticles}
                                    chrome={chrome}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}

function RelatedSection({
    heading,
    links,
    chrome,
}: {
    heading: string
    links: DrawerLink[]
    chrome: DataPerspectivesChrome
}) {
    if (links.length === 0) return null
    return (
        <section className="dp-drawer__section">
            <h3 className="dp-drawer__section-heading">{heading}</h3>
            <ol className="dp-drawer__list">
                {links.map((link) => (
                    <li key={link.url}>
                        <a className="dp-drawer__item" href={link.url}>
                            <span className="dp-drawer__thumb">
                                {link.slug ? (
                                    <GrapherImage
                                        slug={link.slug}
                                        queryString={thumbQueryString(
                                            "",
                                            chrome
                                        )}
                                        alt={link.title}
                                        noFormatting
                                    />
                                ) : link.imageUrl ? (
                                    <img
                                        src={link.imageUrl}
                                        alt=""
                                        loading="lazy"
                                    />
                                ) : null}
                            </span>
                            <span className="dp-drawer__item-text">
                                <span className="dp-drawer__item-title">
                                    {link.title}
                                </span>
                            </span>
                        </a>
                    </li>
                ))}
            </ol>
        </section>
    )
}
