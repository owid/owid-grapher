import * as React from "react"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCommentAlt,
    faTimes,
    faPaperPlane,
} from "@fortawesome/free-solid-svg-icons"
import { observable, action, toJS, computed, makeObservable } from "mobx"
import classnames from "classnames"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { stringifyUnknownError } from "@ourworldindata/utils"
import { createRoot } from "react-dom/client"

const sendFeedback = async (feedback: Feedback) => {
    const json = {
        ...toJS(feedback),
        environment: `Current URL: ${window.location.href}\nUser Agent: ${navigator.userAgent}\nViewport: ${window.innerWidth}x${window.innerHeight}`,
    }

    return await fetch("https://feedback.owid.io", {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=UTF-8" },
        body: JSON.stringify(json),
    }).then((res) => {
        if (!res.ok)
            throw new Error(
                `Sending feedback failed: ${res.status} ${res.statusText}`
            )
    })
}

class Feedback {
    @observable name: string = ""
    @observable email: string = ""
    @observable message: string = ""
    environment: string = ""

    constructor() {
        makeObservable(this)
    }

    @action.bound clear() {
        this.name = ""
        this.email = ""
        this.message = ""
    }
}

const vaccinationRegex = /vaccination|vaccine|doses|vaccinat/i
const licensingRegex = /license|licensing|copyright|permission|permit/i
const citationRegex = /cite|citation|citing|reference/i
const translateRegex = /translat/i

enum SpecialFeedbackTopic {
    Vaccination,
    Licensing,
    Citation,
    Translation,
}

interface SpecialTopicMatcher {
    regex: RegExp
    topic: SpecialFeedbackTopic
}

const topicMatchers: SpecialTopicMatcher[] = [
    { regex: vaccinationRegex, topic: SpecialFeedbackTopic.Vaccination },
    { regex: licensingRegex, topic: SpecialFeedbackTopic.Licensing },
    { regex: citationRegex, topic: SpecialFeedbackTopic.Citation },
    { regex: translateRegex, topic: SpecialFeedbackTopic.Translation },
]

const vaccineNotice = (
    <a
        key="vaccineNotice"
        href={`${BAKED_BASE_URL}/covid-vaccinations#frequently-asked-questions`}
        target="_blank"
        rel="noopener"
    >
        Covid Vaccines Questions
    </a>
)

const copyrightNotice = (
    <a
        key="copyrightNotice"
        href={`${BAKED_BASE_URL}/faqs#how-is-your-work-copyrighted`}
        target="_blank"
        rel="noopener"
    >
        Copyright Queries
    </a>
)
const citationNotice = (
    <a
        key="citationNotice"
        href={`${BAKED_BASE_URL}/faqs#how-should-i-cite-your-work`}
        target="_blank"
        rel="noopener"
    >
        How to Cite our Work
    </a>
)
const translateNotice = (
    <a
        key="translateNotice"
        href={`${BAKED_BASE_URL}/faqs#can-i-translate-your-work-into-another-language`}
        target="_blank"
        rel="noopener"
    >
        Translating our work
    </a>
)

const topicNotices = new Map<SpecialFeedbackTopic, React.ReactElement>([
    [SpecialFeedbackTopic.Vaccination, vaccineNotice],
    [SpecialFeedbackTopic.Citation, citationNotice],
    [SpecialFeedbackTopic.Licensing, copyrightNotice],
    [SpecialFeedbackTopic.Translation, translateNotice],
])

interface FeedbackFormProps {
    onClose?: () => void
    autofocus?: boolean
}

@observer
export class FeedbackForm extends React.Component<FeedbackFormProps> {
    feedback: Feedback = new Feedback()
    @observable loading: boolean = false
    @observable done: boolean = false
    @observable error: string | undefined

    constructor(props: FeedbackFormProps) {
        super(props)
        makeObservable(this)
    }

    async submit() {
        try {
            await sendFeedback(this.feedback)
            this.feedback.clear()
            this.done = true
        } catch (err) {
            this.error = stringifyUnknownError(err)
        } finally {
            this.loading = false
        }
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        this.done = false
        this.error = undefined
        this.loading = true
        void this.submit()
    }

    @action.bound onName(e: React.ChangeEvent<HTMLInputElement>) {
        this.feedback.name = e.currentTarget.value
    }

    @action.bound onEmail(e: React.ChangeEvent<HTMLInputElement>) {
        this.feedback.email = e.currentTarget.value
    }

    @action.bound onMessage(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.feedback.message = e.currentTarget.value
    }

    @action.bound onClose() {
        if (this.props.onClose) {
            this.props.onClose()
        }
        // Clear the form after closing, in case the user has a 2nd message to send later.
        this.done = false
    }

    @computed private get specialTopic(): SpecialFeedbackTopic | undefined {
        const { message } = this.feedback
        return topicMatchers.find((matcher) => matcher.regex.test(message))
            ?.topic
    }

    renderBody() {
        const { loading, done, specialTopic } = this
        const autofocus = this.props.autofocus ?? true

        if (done) {
            return (
                <div className="doneMessage">
                    <div className="icon">
                        <FontAwesomeIcon icon={faPaperPlane} />
                    </div>
                    <div className="message">
                        <h3>Thank you for your feedback</h3>
                        <p>
                            We read all feedback, but due to a high volume of
                            messages we are not able to reply to all.
                        </p>
                    </div>
                    <div aria-label="Close feedback form" className="actions">
                        <button onClick={this.onClose}>Close</button>
                    </div>
                </div>
            )
        }

        const notices = specialTopic
            ? topicNotices.get(specialTopic)
            : undefined
        return (
            <React.Fragment>
                <div className="header">Leave us feedback</div>
                <div className="notice">
                    <p>
                        <strong>Have a question?</strong> You may find an answer
                        in:
                        <br />
                        <a
                            href={`${BAKED_BASE_URL}/faqs`}
                            target="_blank"
                            rel="noopener"
                        >
                            <strong>General FAQ</strong>
                        </a>{" "}
                        or{" "}
                        <a
                            href={`${BAKED_BASE_URL}/covid-vaccinations#frequently-asked-questions`}
                            target="_blank"
                            rel="noopener"
                        >
                            <strong>Vaccinations FAQ</strong>
                        </a>
                    </p>
                </div>
                <div className="formBody">
                    <div className="formSection formSectionExpand">
                        <label htmlFor="feedback.message">Message</label>
                        <textarea
                            id="feedback.message"
                            className="sentry-mask"
                            onChange={this.onMessage}
                            rows={5}
                            minLength={30}
                            required
                            disabled={loading}
                        />
                        {notices ? (
                            <div className="topic-notice">
                                Your question may be answered in{" "}
                                <strong>{notices}</strong>.
                            </div>
                        ) : null}
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.name">Your name</label>
                        <input
                            id="feedback.name"
                            className="sentry-mask"
                            onChange={this.onName}
                            autoFocus={autofocus}
                            disabled={loading}
                        />
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.email">Email address</label>
                        <input
                            id="feedback.email"
                            className="sentry-mask"
                            onChange={this.onEmail}
                            type="email"
                            disabled={loading}
                        />
                        <small className="form-text text-muted">
                            Your name and email will only be used to reply to
                            you and not for any other purpose. If you do not
                            give a valid email, we will not be able to reply to
                            you.
                        </small>
                    </div>
                    {this.error ? (
                        <div style={{ color: "red" }}>{this.error}</div>
                    ) : undefined}
                    {this.done ? (
                        <div style={{ color: "green" }}>
                            Thanks for your feedback!
                        </div>
                    ) : undefined}
                </div>
                <div className="footer">
                    <button
                        aria-label="Submit feedback"
                        type="submit"
                        disabled={loading}
                    >
                        Send message
                    </button>
                </div>
            </React.Fragment>
        )
    }

    override render() {
        return (
            <form
                className={classnames("FeedbackForm", {
                    loading: this.loading,
                })}
                onSubmit={this.onSubmit}
            >
                {this.renderBody()}
            </form>
        )
    }
}

@observer
export class FeedbackPrompt extends React.Component {
    @observable isOpen: boolean = false

    constructor(props: Record<string, never>) {
        super(props)
        makeObservable(this)
    }

    @action.bound toggleOpen() {
        this.isOpen = !this.isOpen
    }

    @action.bound onClose() {
        this.isOpen = false
    }

    @action.bound onClickOutside() {
        this.onClose()
    }

    override render() {
        return (
            <div
                className={`feedbackPromptContainer${
                    this.isOpen ? " active" : ""
                }`}
            >
                {/* We are keeping the form always rendered to avoid wiping all contents
                when a user accidentally closes the form */}
                <div style={{ display: this.isOpen ? "block" : "none" }}>
                    <div className="overlay" onClick={this.onClickOutside} />
                    <div className="box">
                        <FeedbackForm onClose={this.onClose} />
                    </div>
                </div>
                {this.isOpen ? (
                    <button
                        aria-label="Close feedback form"
                        className="prompt"
                        onClick={this.toggleOpen}
                    >
                        <FontAwesomeIcon icon={faTimes} /> Close
                    </button>
                ) : (
                    <button
                        aria-label="Open feedback form"
                        className="prompt"
                        data-track-note="page_open_feedback"
                        onClick={this.toggleOpen}
                    >
                        <FontAwesomeIcon icon={faCommentAlt} /> Feedback
                    </button>
                )}
            </div>
        )
    }
}

export function runFeedbackPage() {
    const elem = document.querySelector(".FeedbackPage main")
    if (!elem) throw new Error("FeedbackPage main element not found in DOM")

    const root = createRoot(elem)
    root.render(
        <div className="box">
            <FeedbackForm />
        </div>
    )
}
