import { useEffect, useState, type SyntheticEvent } from "react"
import * as Sentry from "@sentry/react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faComment,
    faFlask,
    faLink,
    faXmark,
} from "@fortawesome/free-solid-svg-icons"
import { copyToClipboard } from "@ourworldindata/utils"
import { PROD_URL } from "../SiteConstants.js"
import {
    LABS_FEATURES,
    LABS_MASTER_SHA,
    showFeature,
    useFeaturesOnPage,
} from "./labsFeatures.js"
import "./LabsBar.scss"

// Labs is a staff-only copy of the site, built from the `labs` branch: master
// plus every open PR labelled `labs`. This bar only exists on that branch.

const REPO_URL = "https://github.com/owid/owid-grapher"
const PANEL_ID = "labs-panel"

function publicUrlForCurrentPage(): string {
    const { pathname, search, hash } = window.location
    return `${PROD_URL}${pathname}${search}${hash}`
}

/**
 * Sentry's feedback form, added on first use. It's bundled rather than lazy-loaded
 * from Sentry's CDN, which ad blockers block even when they let replays through.
 */
function loadFeedback(): ReturnType<typeof Sentry.getFeedback> {
    if (Sentry.getFeedback() || !Sentry.getClient()) return Sentry.getFeedback()
    Sentry.addIntegration(
        Sentry.feedbackIntegration({
            autoInject: false,
            colorScheme: "light",
            showBranding: false,
            showEmail: false,
            formTitle: "Feedback on Labs",
            submitButtonLabel: "Send feedback",
            messagePlaceholder:
                "What worked, what didn't, what you expected instead",
            successMessageText: "Thanks, we'll read it.",
        })
    )
    return Sentry.getFeedback()
}

/**
 * Whether this browser can reach Sentry. Ad blockers block its host outright,
 * and then feedback (and the replay) would fail only once it's sent.
 */
async function canReachSentry(): Promise<boolean> {
    const dsn = Sentry.getClient()?.getDsn()
    if (!dsn) return false
    try {
        await fetch(`${dsn.protocol}://${dsn.host}/`, { mode: "no-cors" })
        return true
    } catch {
        return false
    }
}

/**
 * The feedback arrives in Sentry with the session's replay and the features on
 * the page. Returns false when Sentry is blocked, so the bar can say so.
 */
async function openFeedbackForm(featuresOnPage: number[]): Promise<boolean> {
    const feedback = loadFeedback()
    if (!feedback || !(await canReachSentry())) return false
    const form = await feedback.createForm({
        tags: {
            labs_features_on_page: featuresOnPage.join(",") || "none",
        },
        onFormClose: () => form.removeFromDom(),
        onFormSubmitted: () => form.removeFromDom(),
    })
    form.appendToDom()
    form.open()
    return true
}

function LabsPanel({ featuresOnPage }: { featuresOnPage: number[] }) {
    // Features on this page first, so nobody has to hunt for them
    const features = [...LABS_FEATURES].sort(
        (a, b) =>
            Number(featuresOnPage.includes(b.number)) -
            Number(featuresOnPage.includes(a.number))
    )
    return (
        <section className="labs-panel" id={PANEL_ID} aria-label="On Labs now">
            <header className="labs-panel__header">
                <h2 className="labs-panel__title">On Labs now</h2>
                {LABS_MASTER_SHA && (
                    <p className="labs-panel__build">
                        Built from master at{" "}
                        <a href={`${REPO_URL}/commit/${LABS_MASTER_SHA}`}>
                            {LABS_MASTER_SHA}
                        </a>
                    </p>
                )}
            </header>
            {features.length > 0 ? (
                <ul className="labs-panel__features">
                    {features.map((feature) => {
                        const isOnPage = featuresOnPage.includes(feature.number)
                        return (
                            <li
                                key={feature.number}
                                className={
                                    isOnPage
                                        ? "labs-panel__feature labs-panel__feature--on-page"
                                        : "labs-panel__feature"
                                }
                            >
                                <span className="labs-panel__feature-title">
                                    {feature.title}
                                </span>
                                <span className="labs-panel__feature-meta">
                                    {isOnPage && (
                                        <>
                                            <button
                                                type="button"
                                                className="labs-panel__show"
                                                onClick={() =>
                                                    showFeature(feature.number)
                                                }
                                            >
                                                Show me on this page
                                            </button>
                                            {" · "}
                                        </>
                                    )}
                                    <a
                                        href={`${REPO_URL}/pull/${feature.number}`}
                                    >
                                        #{feature.number}
                                    </a>
                                    {` · ${feature.author}`}
                                </span>
                            </li>
                        )
                    })}
                </ul>
            ) : (
                <p className="labs-panel__empty">
                    {LABS_MASTER_SHA
                        ? "No features on Labs right now: it's the same as the live site."
                        : // features.json as committed here, before the rebuild writes it
                          "The list of features isn't built yet."}
                </p>
            )}
            <p className="labs-panel__recording">
                Labs records every session in Sentry, to see how features are
                used.
            </p>
        </section>
    )
}

export function LabsBar({ onHide }: { onHide: () => void }) {
    const [isHidden, setIsHidden] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [isFeedbackBlocked, setIsFeedbackBlocked] = useState(false)
    const featuresOnPage = useFeaturesOnPage()

    useEffect(() => {
        if (!isOpen) return
        const closeOnEscape = (event: KeyboardEvent): void => {
            if (event.key === "Escape") setIsOpen(false)
        }
        document.addEventListener("keydown", closeOnEscape)
        return () => document.removeEventListener("keydown", closeOnEscape)
    }, [isOpen])

    const copyPublicLink = async (): Promise<void> => {
        const url = publicUrlForCurrentPage()
        if (await copyToClipboard(url)) {
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } else {
            window.prompt("Public link to this page", url)
        }
    }

    const hide = (): void => {
        setIsHidden(true)
        onHide()
    }

    // Charts keep their state in the URL, so take the address when it's used
    const pointAtCurrentPage = (
        event: SyntheticEvent<HTMLAnchorElement>
    ): void => {
        event.currentTarget.href = publicUrlForCurrentPage()
    }

    if (isHidden) return null

    return (
        <div className="labs-bar">
            {isOpen && <LabsPanel featuresOnPage={featuresOnPage} />}
            {isFeedbackBlocked && (
                <p className="labs-bar__notice" role="alert">
                    An ad blocker is blocking Sentry, where feedback goes. Allow
                    it on labs.owid.io (or switch the blocker off here) and
                    reload. It also keeps your session from being recorded.
                </p>
            )}
            <div className="labs-bar__row">
                <button
                    type="button"
                    className="labs-bar__toggle"
                    aria-expanded={isOpen}
                    aria-controls={PANEL_ID}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="labs-bar__tile" aria-hidden="true">
                        <FontAwesomeIcon icon={faFlask} />
                    </span>
                    You're on Labs
                    {featuresOnPage.length > 0 && (
                        <span className="labs-bar__count">
                            {featuresOnPage.length} here
                        </span>
                    )}
                </button>
                <a
                    className="labs-bar__button"
                    href={PROD_URL}
                    onPointerDown={pointAtCurrentPage}
                    onFocus={pointAtCurrentPage}
                >
                    Open live site
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
                <button
                    type="button"
                    className="labs-bar__button"
                    onClick={copyPublicLink}
                >
                    <FontAwesomeIcon icon={faLink} />
                    {isCopied ? "Copied" : "Copy public link"}
                </button>
                <button
                    type="button"
                    className="labs-bar__button"
                    onClick={async () => {
                        const opened = await openFeedbackForm(featuresOnPage)
                        setIsFeedbackBlocked(!opened)
                    }}
                >
                    <FontAwesomeIcon icon={faComment} />
                    Feedback
                </button>
                <button
                    type="button"
                    className="labs-bar__button labs-bar__button--icon"
                    onClick={hide}
                    aria-label="Hide the Labs bar"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
        </div>
    )
}
