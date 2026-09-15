import { useEffect, useId, useState } from "react"
import {
    ExpandableToggle,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { faThumbsDown, faThumbsUp } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

const ASK_CHART_FAQ_API_ENDPOINT = "/api/ask-chart/faq"
const MAX_FEEDBACK_REASON_LENGTH = 2000

interface AskThisChartFaq {
    question: string
    answer: string
}

// Thumbs up/down rating for a single answer. On thumbs-down, reveals an
// optional free-text field to say what was wrong. The rating is recorded as
// soon as it's clicked, so a thumbs-down still counts even if no reason is
// given; submitting a reason overwrites that record (same responseId).
function AnswerFeedback({
    slug,
    question,
    answer,
}: {
    slug: string
    question: string
    answer: string
}) {
    const [rating, setRating] = useState<"up" | "down" | undefined>(undefined)
    const [reason, setReason] = useState("")
    const [isDone, setIsDone] = useState(false)
    const reasonFieldId = useId()

    // Prototype: feedback is only logged client-side for now. To persist it,
    // POST this payload to a backend endpoint (e.g. /api/ask-chart/feedback).
    const recordFeedback = (
        ratingValue: "up" | "down",
        reasonValue?: string
    ): void => {
        // eslint-disable-next-line no-console
        console.log("ask-this-chart feedback", {
            slug,
            rating: ratingValue,
            question,
            answer,
            reason: reasonValue,
        })
    }

    const handleRate = (ratingValue: "up" | "down"): void => {
        setRating(ratingValue)
        recordFeedback(ratingValue)
        if (ratingValue === "up") setIsDone(true)
    }

    if (isDone)
        return (
            <p className="ask-this-chart__feedback-thanks">
                Thanks for your feedback.
            </p>
        )

    return (
        <div className="ask-this-chart__feedback">
            {!rating && (
                <div className="ask-this-chart__feedback-rate">
                    <span className="ask-this-chart__feedback-label">
                        Was this helpful?
                    </span>
                    <button
                        type="button"
                        className="ask-this-chart__feedback-button"
                        aria-label="Yes, this answer was helpful"
                        onClick={() => handleRate("up")}
                    >
                        <FontAwesomeIcon icon={faThumbsUp} />
                    </button>
                    <button
                        type="button"
                        className="ask-this-chart__feedback-button"
                        aria-label="No, this answer was not helpful"
                        onClick={() => handleRate("down")}
                    >
                        <FontAwesomeIcon icon={faThumbsDown} />
                    </button>
                </div>
            )}
            {rating === "down" && (
                <form
                    className="ask-this-chart__feedback-reason"
                    onSubmit={(event) => {
                        event.preventDefault()
                        const trimmedReason = reason.trim()
                        if (trimmedReason) recordFeedback("down", trimmedReason)
                        setIsDone(true)
                    }}
                >
                    <label
                        className="ask-this-chart__feedback-reason-label"
                        htmlFor={reasonFieldId}
                    >
                        What was wrong with this answer? (optional)
                    </label>
                    <textarea
                        id={reasonFieldId}
                        className="ask-this-chart__feedback-reason-input"
                        value={reason}
                        maxLength={MAX_FEEDBACK_REASON_LENGTH}
                        rows={3}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    <button
                        type="submit"
                        className="ask-this-chart__feedback-reason-submit"
                    >
                        Send
                    </button>
                </form>
            )}
        </div>
    )
}

export default function AskThisChart({ slug }: { slug: string }) {
    const [faqs, setFaqs] = useState<AskThisChartFaq[] | undefined>(undefined)
    const [isLoadingFaqs, setIsLoadingFaqs] = useState(true)

    // Load the pre-generated, chart-specific FAQ entries
    useEffect(() => {
        const abortController = new AbortController()
        const loadFaqs = async (): Promise<void> => {
            try {
                const response = await fetch(
                    `${ASK_CHART_FAQ_API_ENDPOINT}?slug=${encodeURIComponent(slug)}`,
                    { signal: abortController.signal }
                )
                if (!response.ok) return
                const parsed = (await response.json()) as {
                    faqs?: AskThisChartFaq[]
                }
                if (parsed.faqs?.length) setFaqs(parsed.faqs)
            } catch {
                // The section hides itself if the FAQs can't be generated
            } finally {
                if (!abortController.signal.aborted) setIsLoadingFaqs(false)
            }
        }
        void loadFaqs()
        return () => abortController.abort()
    }, [slug])

    // Nothing to show if the FAQs couldn't be generated for this chart
    if (!isLoadingFaqs && !faqs) return null

    return (
        <div className="ask-this-chart-wrapper span-cols-14 grid grid-cols-12-full-width">
            <h2 className="h2-bold span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                Common questions about this chart
            </h2>
            <div className="ask-this-chart span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                <p className="ask-this-chart__intro">
                    Answered by an AI model based on the chart's data and source
                    documentation.
                </p>
                {isLoadingFaqs && (
                    <p className="ask-this-chart__faqs-loading">
                        Loading questions about this chart…
                    </p>
                )}
                {faqs && (
                    <div className="ask-this-chart__faqs">
                        {faqs.map((faq) => (
                            <ExpandableToggle
                                key={faq.question}
                                label={faq.question}
                                isStacked
                                content={
                                    <div className="ask-this-chart__faq-answer">
                                        <SimpleMarkdownText text={faq.answer} />
                                        <AnswerFeedback
                                            slug={slug}
                                            question={faq.question}
                                            answer={faq.answer}
                                        />
                                    </div>
                                }
                            />
                        ))}
                    </div>
                )}
                <p className="ask-this-chart__disclaimer">
                    Answers are generated by an AI model and may contain
                    mistakes. Please check them against the sources documented
                    above.
                </p>
            </div>
        </div>
    )
}
