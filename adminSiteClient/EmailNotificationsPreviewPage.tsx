import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { Checkbox, DatePicker, Radio, Select, Spin } from "antd"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPES,
    EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS,
    EMAIL_NOTIFICATIONS_FREQUENCIES,
    EMAIL_NOTIFICATIONS_FREQUENCY_LABELS,
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
} from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"

// Previews the notification email the send job would produce, from real
// published content, for a mock subscriber whose preferences are set here.
// The rendering and the preference filtering are the same code the send job
// runs, so what's shown is what a subscriber with these settings would get.

// Gmail truncates messages larger than this, hiding everything past the cut
// behind a "View entire message" link.
const GMAIL_CLIPPING_LIMIT_BYTES = 102 * 1024

interface EmailPreview {
    html: string
    text: string
    itemCount: number
    publishedInWindowCount: number
    htmlBytes: number
    windowStart: string
}

interface MockSubscription {
    email: string
    frequency: EmailNotificationsFrequency
    contentTypes: EmailNotificationsContentType[]
    topicTags: string[]
    /** The day the mock send happens, as YYYY-MM-DD. */
    sentAt: string
}

const DATE_FORMAT = "YYYY-MM-DD"

const DEFAULT_SUBSCRIPTION: MockSubscription = {
    email: "preview@ourworldindata.org",
    frequency: "weekly",
    contentTypes: [...EMAIL_NOTIFICATIONS_CONTENT_TYPES],
    topicTags: [],
    sentAt: dayjs.utc().format(DATE_FORMAT),
}

function formatBytes(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)}KB`
}

export const EmailNotificationsPreviewPage = () => {
    const { admin } = useContext(AdminAppContext)

    const [subscription, setSubscription] =
        useState<MockSubscription>(DEFAULT_SUBSCRIPTION)
    const [availableTopics, setAvailableTopics] = useState<string[]>([])
    const [preview, setPreview] = useState<EmailPreview | undefined>()
    const [showPlainText, setShowPlainText] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | undefined>()

    const query = useMemo(() => {
        const params = new URLSearchParams()
        params.set("email", subscription.email)
        params.set("frequency", subscription.frequency)
        params.set("sentAt", subscription.sentAt)
        params.set("contentTypes", subscription.contentTypes.join(","))
        params.set("topicTags", subscription.topicTags.join(","))
        return params.toString()
    }, [subscription])

    useEffect(() => {
        void admin
            .getJSON("/api/email-notifications-preview/topics")
            .then((response) =>
                setAvailableTopics(
                    (response as { topicTags: string[] }).topicTags
                )
            )
            .catch((error: unknown) => setError(String(error)))
    }, [admin])

    const fetchPreview = useCallback(async () => {
        setIsLoading(true)
        setError(undefined)
        try {
            const response = await admin.getJSON(
                `/api/email-notifications-preview?${query}`
            )
            setPreview(response as EmailPreview)
        } catch (error) {
            setError(String(error))
        } finally {
            setIsLoading(false)
        }
    }, [admin, query])

    useEffect(() => {
        void fetchPreview()
    }, [fetchPreview])

    const update = (changes: Partial<MockSubscription>) =>
        setSubscription((current) => ({ ...current, ...changes }))

    return (
        <AdminLayout title="Email notification preview">
            <main className="EmailNotificationsPreviewPage">
                <h2>Email notification preview</h2>
                <p className="text-muted">
                    The notification email as a subscriber with these
                    preferences would receive it. The content window follows
                    from the send date and frequency, as it does for a real
                    subscriber
                    {preview &&
                        `: ${dayjs.utc(preview.windowStart).format("MMMM D, YYYY")} to ${dayjs.utc(subscription.sentAt).format("MMMM D, YYYY")}`}
                    .
                </p>

                <div className="EmailNotificationsPreviewPage__layout">
                    <form className="EmailNotificationsPreviewPage__controls">
                        <label
                            className="EmailNotificationsPreviewPage__field"
                            htmlFor="preview-email"
                        >
                            <span>Subscriber email</span>
                            <input
                                id="preview-email"
                                type="text"
                                className="form-control"
                                value={subscription.email}
                                onChange={(event) =>
                                    update({ email: event.target.value })
                                }
                            />
                            <small className="text-muted">
                                Shown in the footer.
                            </small>
                        </label>

                        <div className="EmailNotificationsPreviewPage__field">
                            <span>Frequency</span>
                            <Radio.Group
                                value={subscription.frequency}
                                onChange={(event) =>
                                    update({ frequency: event.target.value })
                                }
                            >
                                {EMAIL_NOTIFICATIONS_FREQUENCIES.map(
                                    (frequency) => (
                                        <Radio
                                            key={frequency}
                                            value={frequency}
                                        >
                                            {
                                                EMAIL_NOTIFICATIONS_FREQUENCY_LABELS[
                                                    frequency
                                                ]
                                            }
                                        </Radio>
                                    )
                                )}
                            </Radio.Group>
                            <small className="text-muted">
                                Sets how far back the content window reaches,
                                and the email's wording.
                            </small>
                        </div>

                        <div className="EmailNotificationsPreviewPage__field">
                            <span>Content types</span>
                            <Checkbox.Group
                                value={subscription.contentTypes}
                                onChange={(contentTypes) =>
                                    update({ contentTypes })
                                }
                                options={EMAIL_NOTIFICATIONS_CONTENT_TYPES.map(
                                    (contentType) => ({
                                        label: EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS[
                                            contentType
                                        ],
                                        value: contentType,
                                    })
                                )}
                            />
                        </div>

                        <label
                            className="EmailNotificationsPreviewPage__field"
                            htmlFor="preview-topics"
                        >
                            <span>Topics</span>
                            <Select
                                id="preview-topics"
                                mode="multiple"
                                allowClear
                                placeholder="All topics"
                                value={subscription.topicTags}
                                onChange={(topicTags) => update({ topicTags })}
                                options={availableTopics.map((topic) => ({
                                    label: topic,
                                    value: topic,
                                }))}
                            />
                            <small className="text-muted">
                                Leave empty for all topics. Announcements are
                                never topic-filtered.
                            </small>
                        </label>

                        <label
                            className="EmailNotificationsPreviewPage__field"
                            htmlFor="preview-sent-at"
                        >
                            <span>Send date</span>
                            <DatePicker
                                id="preview-sent-at"
                                allowClear={false}
                                format={DATE_FORMAT}
                                value={dayjs.utc(subscription.sentAt)}
                                onChange={(sentAt) =>
                                    sentAt &&
                                    update({
                                        sentAt: sentAt.format(DATE_FORMAT),
                                    })
                                }
                            />
                            <small className="text-muted">
                                UTC. Pick an earlier date to see what a past
                                send would have looked like.
                            </small>
                        </label>

                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() =>
                                setSubscription(DEFAULT_SUBSCRIPTION)
                            }
                        >
                            Reset
                        </button>
                    </form>

                    <div className="EmailNotificationsPreviewPage__preview">
                        <div className="EmailNotificationsPreviewPage__toolbar">
                            <Radio.Group
                                value={showPlainText}
                                onChange={(event) =>
                                    setShowPlainText(event.target.value)
                                }
                                optionType="button"
                                options={[
                                    { label: "HTML", value: false },
                                    { label: "Plain text", value: true },
                                ]}
                            />
                            {preview && (
                                <span className="EmailNotificationsPreviewPage__stats text-muted">
                                    {preview.itemCount} of{" "}
                                    {preview.publishedInWindowCount} items
                                    published in the window ·{" "}
                                    <span
                                        className={
                                            preview.htmlBytes >
                                            GMAIL_CLIPPING_LIMIT_BYTES
                                                ? "text-danger"
                                                : undefined
                                        }
                                        title={`Gmail clips emails over ${formatBytes(GMAIL_CLIPPING_LIMIT_BYTES)}`}
                                    >
                                        {formatBytes(preview.htmlBytes)}
                                    </span>
                                    {isLoading && <Spin size="small" />}
                                </span>
                            )}
                        </div>

                        {error && (
                            <div className="alert alert-danger">{error}</div>
                        )}

                        {!preview && isLoading && <Spin />}

                        {preview && preview.itemCount === 0 && (
                            <div className="alert alert-warning">
                                No content matches these preferences.{" "}
                                {preview.publishedInWindowCount > 0
                                    ? `${preview.publishedInWindowCount} item(s) were published in the window but filtered out — the send job would skip this subscriber.`
                                    : "Nothing was published in the window; try a weekly frequency or a later send date."}
                            </div>
                        )}

                        {preview &&
                            preview.itemCount > 0 &&
                            (showPlainText ? (
                                <pre className="EmailNotificationsPreviewPage__plain-text">
                                    {preview.text}
                                </pre>
                            ) : (
                                <iframe
                                    className="EmailNotificationsPreviewPage__frame"
                                    title="Email preview"
                                    srcDoc={preview.html}
                                    // The email is untrusted-ish rendered
                                    // markup; it needs no scripts to display.
                                    sandbox=""
                                />
                            ))}
                    </div>
                </div>
            </main>
        </AdminLayout>
    )
}
