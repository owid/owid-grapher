import React from "react"
import ReactDOM from "react-dom"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCommentAlt } from "@fortawesome/free-solid-svg-icons/faCommentAlt"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { observable, action, toJS, computed } from "mobx"
import classnames from "classnames"
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons/faPaperPlane"

const sendFeedback = (feedback: Feedback) =>
    new Promise((resolve, reject) => {
        const json = toJS(feedback)
        const req = new XMLHttpRequest()

        json.environment = `Current URL: ${window.location.href}\nUser Agent: ${navigator.userAgent}\nViewport: ${window.innerWidth}x${window.innerHeight}`

        req.addEventListener("readystatechange", () => {
            if (req.readyState === 4) {
                if (req.status !== 200)
                    reject(`${req.status} ${req.statusText}`)
                else resolve(undefined)
            }
        })

        req.open(
            "POST",
            `https://owid-feedback.netlify.app/.netlify/functions/hello`
        )
        req.setRequestHeader("Content-Type", "application/json;charset=UTF-8")

        req.send(JSON.stringify(json))
    })

class Feedback {
    @observable name: string = ""
    @observable email: string = ""
    @observable message: string = ""
    environment: string = ""

    @action.bound clear() {
        this.name = ""
        this.email = ""
        this.message = ""
    }
}

const vaccinationRegex = /vaccination|vaccine|doses|vaccinat/i
const licensingRegex = /license|licensing|copyright/i
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

const topicMatchers = [
    { regex: vaccinationRegex, topic: SpecialFeedbackTopic.Vaccination },
    { regex: licensingRegex, topic: SpecialFeedbackTopic.Licensing },
    { regex: citationRegex, topic: SpecialFeedbackTopic.Citation },
    { regex: translateRegex, topic: SpecialFeedbackTopic.Translation },
]

const vaccineNotice = (
    <a
        key="vaccineNotice"
        href="https://ourworldindata.org/covid-vaccinations#frequently-asked-questions"
        target="_blank"
        rel="noreferrer"
    >
        Covid Vaccines Questions
    </a>
)

const copyrightNotice = (
    <a
        key="copyrightNotice"
        href="https://ourworldindata.org/faqs#how-is-your-work-copyrighted"
        target="_blank"
        rel="noreferrer"
    >
        Copyright Queries
    </a>
)
const citationNotice = (
    <a
        key="citationNotice"
        href="https://ourworldindata.org/faqs#how-should-i-cite-your-work"
        target="_blank"
        rel="noreferrer"
    >
        How to Cite our Work
    </a>
)
const translateNotice = (
    <a
        key="translateNotice"
        href="https://ourworldindata.org/faqs#can-i-translate-your-work-into-another-language"
        target="_blank"
        rel="noreferrer"
    >
        Translating our work
    </a>
)

const topicNotices = new Map<SpecialFeedbackTopic, JSX.Element>([
    [SpecialFeedbackTopic.Vaccination, vaccineNotice],
    [SpecialFeedbackTopic.Citation, citationNotice],
    [SpecialFeedbackTopic.Licensing, copyrightNotice],
    [SpecialFeedbackTopic.Translation, translateNotice],
])

@observer
export class FeedbackForm extends React.Component<{
    onClose?: () => void
    autofocus?: boolean
}> {
    feedback: Feedback = new Feedback()
    @observable loading: boolean = false
    @observable done: boolean = false
    @observable error: string | undefined

    async submit() {
        try {
            await sendFeedback(this.feedback)
            this.feedback.clear()
            this.done = true
        } catch (err) {
            this.error = err
        } finally {
            this.loading = false
        }
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        this.done = false
        this.error = undefined
        this.loading = true
        this.submit()
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
                    <div className="actions">
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
                        You may have a question we've already answered in&nbsp;
                        <a
                            href="https://ourworldindata.org/faqs"
                            target="_blank"
                            rel="noreferrer"
                        >
                            our Frequently Asked Questions.
                        </a>
                        <br></br>
                        Questions about our Covid vaccination data might&nbsp;
                        be already answered in&nbsp;
                        <a
                            href="https://ourworldindata.org/covid-vaccinations#frequently-asked-questions"
                            target="_blank"
                            rel="noreferrer"
                        >
                            our vaccination FAQ.
                        </a>
                    </p>
                </div>
                <div className="formBody">
                    <div className="formSection formSectionExpand">
                        <label htmlFor="feedback.message">Message</label>
                        <textarea
                            id="feedback.message"
                            onChange={this.onMessage}
                            rows={5}
                            minLength={30}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.name">Your name</label>
                        <input
                            id="feedback.name"
                            onChange={this.onName}
                            autoFocus={autofocus}
                            disabled={loading}
                        />
                    </div>
                    <div className="formSection">
                        <label htmlFor="feedback.email">Email address</label>
                        <input
                            id="feedback.email"
                            onChange={this.onEmail}
                            type="email"
                            required
                            disabled={loading}
                        />
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
                {notices ? (
                    <div className="topic-notice">
                        Your question may be related to this FAQ entry on &nbsp;
                        {notices}
                    </div>
                ) : null}
                <div className="footer">
                    <button type="submit" disabled={loading}>
                        Send message
                    </button>
                </div>
            </React.Fragment>
        )
    }

    render() {
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

    @action.bound toggleOpen() {
        this.isOpen = !this.isOpen
    }

    @action.bound onClose() {
        this.isOpen = false
    }

    @action.bound onClickOutside() {
        this.onClose()
    }

    render() {
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
                    <button className="prompt" onClick={this.toggleOpen}>
                        <FontAwesomeIcon icon={faTimes} /> Close
                    </button>
                ) : (
                    <button
                        className="prompt"
                        data-track-note="page-open-feedback"
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
    ReactDOM.render(
        <div className="box">
            <FeedbackForm />
        </div>,
        document.querySelector(".FeedbackPage main")
    )
}
