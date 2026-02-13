import {
    faCheck,
    faCircleXmark,
    faXmark,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import cx from "classnames"
import * as _ from "lodash-es"
import {
    type FormEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react"
import { Form } from "react-aria-components"
import { match } from "ts-pattern"
import { uuidv7 } from "uuidv7"
import { Button, RadioButton } from "@ourworldindata/components"
import {
    type UserSurveyExperimentArm,
    type UserSurveyRoleAnswer,
} from "@ourworldindata/types"
import { getExperimentState } from "@ourworldindata/utils"
import {
    markUserSurveyAnswered,
    markUserSurveyDismissed,
} from "../../userSurvey.js"
import { useTriggerOnEscape } from "../../hooks.js"

const USER_SURVEY_NAME = "user-role-v1"
const USER_SURVEY_EXPERIMENT_ID = "exp-user-survey-role-v1"
const USER_SURVEY_FREE_FORM_INPUT_ID = "user-survey-free-form-input"
const USER_SURVEY_FOLLOW_UP_INPUT_ID = "user-survey-follow-up-input"
const USER_SURVEY_TITLE_ID = "user-survey-title"
const USER_SURVEY_FOLLOW_UP_TITLE_ID = "user-survey-follow-up-title"
const USER_SURVEY_FOLLOW_UP_DESCRIPTION_ID = "user-survey-follow-up-description"

type ExperimentArm = "long-list" | "short-list" | "free-form"

const EXPERIMENT_ARM_OPTIONS: ExperimentArm[] = [
    "long-list",
    "short-list",
    "free-form",
]
const DEBUG_DEFAULT_EXPERIMENT_ARM: ExperimentArm =
    getAssignedExperimentArm() ?? "long-list"
const responseId = uuidv7()

type RoleOption = {
    id: string
    label: string
    description?: string
    hasInlineInput?: boolean
}

type SurveyState =
    | { phase: "hidden" }
    | { phase: "role"; experimentArm: UserSurveyExperimentArm }
    | { phase: "thankYou"; roleAnswer: UserSurveyRoleAnswer }

type UserSurveyRoleStepProps = {
    onDismiss: () => void
    onAnswered: (roleAnswer: UserSurveyRoleAnswer) => void
}

const LONG_LIST_OPTIONS: RoleOption[] = _.shuffle<RoleOption>([
    {
        id: "policy-professional",
        label: "Public policy professional",
        description:
            "Policy advisor, government official, or consultant working on public policy",
    },
    {
        id: "journalist-or-media-professional",
        label: "Journalist or media professional",
        description:
            "Reporting, writing, editing, or publishing for media or online platforms",
    },
    {
        id: "educator",
        label: "Educator",
        description: "Teacher, lecturer, or professor",
    },
    {
        id: "student",
        label: "Student",
        description: "School or university student",
    },
    {
        id: "researcher-or-scientist",
        label: "Researcher or scientist",
        description: "Academic or applied research, including think tanks",
    },
    {
        id: "ngo-or-civil-society-professional",
        label: "NGO or civil society professional",
        description: "Working in a local or international nonprofit",
    },
    {
        id: "business-or-investment-professional",
        label: "Business or investment professional",
        description:
            "Working in the private sector, including finance, industry, or startups",
    },
    {
        id: "interested-member-of-the-public",
        label: "Interested member of the public",
        description:
            "Using the site to learn, explore, or inform personal decisions",
    },
    {
        id: "health-professional",
        label: "Health professional",
        description: "Clinician, public health worker, health practitioner",
    },
]).concat([{ id: "other", label: "Other", hasInlineInput: true }])

const SHORT_LIST_OPTIONS: RoleOption[] = _.shuffle<RoleOption>([
    {
        id: "government-civil-society-professional",
        label: "Government or civil society professional",
    },
    {
        id: "researcher-educator-student",
        label: "Researcher, educator, or student",
    },
    {
        id: "business-professional",
        label: "Business professional",
    },
    {
        id: "media-professional-or-journalist",
        label: "Media professional or journalist",
    },
    {
        id: "interested-member-of-public",
        label: "Interested member of the public",
    },
]).concat([{ id: "other", label: "Other", hasInlineInput: true }])

function getAssignedExperimentArm() {
    const assignedArm =
        getExperimentState().assignedExperiments[USER_SURVEY_EXPERIMENT_ID]
    if (
        assignedArm === "long-list" ||
        assignedArm === "short-list" ||
        assignedArm === "free-form"
    )
        return assignedArm
    return null
}

function isValidRoleAnswer(
    selectedOptionId: string | null,
    otherInput: string
) {
    return (
        selectedOptionId !== null &&
        (selectedOptionId !== "other" || otherInput.trim().length > 0)
    )
}

function getFreeFormInput(selectedOptionId: string, otherInput: string) {
    if (selectedOptionId !== "other") return undefined
    return otherInput.trim()
}

function getSelectedOptionMeta(
    selectedOptionId: string,
    options: readonly { id: string; label: string }[]
) {
    const selectedOptionIndex = options.findIndex(
        (option) => option.id === selectedOptionId
    )
    if (selectedOptionIndex === -1) return undefined

    return {
        optionIndex: selectedOptionIndex,
        optionLabel: options[selectedOptionIndex].label,
    }
}

function getFeedbackEnvironment() {
    return `Current URL: ${window.location.href}\nUser Agent: ${navigator.userAgent}\nViewport: ${window.innerWidth}x${window.innerHeight}`
}

function logSurveyDebug(action: string, payload: object) {
    console.log(`[UserSurvey debug] ${action}`, payload)
}

async function sendFeedbackEmail({ message }: { message: string }) {
    logSurveyDebug("api:send-feedback-email", {
        message,
        environment: getFeedbackEnvironment(),
    })
}

async function storeFeedback({
    surveyName,
    responseId,
    feedbackAnswer,
    roleAnswer,
}: {
    surveyName: string
    responseId: string
    feedbackAnswer: string
    roleAnswer: UserSurveyRoleAnswer
}) {
    logSurveyDebug("api:store-feedback", {
        surveyName,
        responseId,
        feedbackAnswer,
        roleAnswer,
    })
}

async function submitFeedback({
    surveyName,
    responseId,
    feedbackAnswer,
    roleAnswer,
}: {
    surveyName: string
    responseId: string
    feedbackAnswer: string
    roleAnswer: UserSurveyRoleAnswer
}) {
    await Promise.all([
        sendFeedbackEmail({
            message: buildFeedbackMessage({
                surveyName,
                responseId,
                feedbackAnswer,
                roleAnswer,
            }),
        }),
        storeFeedback({
            surveyName,
            responseId,
            feedbackAnswer,
            roleAnswer,
        }),
    ])
}

function buildFeedbackMessage({
    surveyName,
    responseId,
    feedbackAnswer,
    roleAnswer,
}: {
    surveyName: string
    responseId: string
    feedbackAnswer: string
    roleAnswer: UserSurveyRoleAnswer
}) {
    const messageLines = [
        "User survey context:",
        `survey_name: ${surveyName}`,
        `response_id: ${responseId}`,
        `experiment_arm: ${roleAnswer.experimentArm}`,
    ]

    if (roleAnswer.freeFormInput !== undefined) {
        messageLines.push(`free_form_input: ${roleAnswer.freeFormInput}`)
    }
    if ("optionId" in roleAnswer) {
        messageLines.push(`option_id: ${roleAnswer.optionId}`)
        messageLines.push(`option_label: ${roleAnswer.optionLabel}`)
        messageLines.push(`option_index: ${roleAnswer.optionIndex}`)
    }

    messageLines.push("", "Follow-up feedback:", feedbackAnswer)
    return messageLines.join("\n")
}

function logRoleSubmit({
    surveyName,
    responseId,
    roleAnswer,
}: {
    surveyName: string
    responseId: string
    roleAnswer: UserSurveyRoleAnswer
}) {
    if (roleAnswer.experimentArm === "free-form") {
        logSurveyDebug("analytics:role-submit", {
            surveyName,
            responseId,
            experimentArm: roleAnswer.experimentArm,
            freeFormInput: roleAnswer.freeFormInput,
        })
        return
    }

    logSurveyDebug("analytics:role-submit", {
        surveyName,
        responseId,
        experimentArm: roleAnswer.experimentArm,
        optionId: roleAnswer.optionId,
        optionLabel: roleAnswer.optionLabel,
        optionIndex: roleAnswer.optionIndex,
        ...(roleAnswer.freeFormInput !== undefined
            ? { freeFormInput: roleAnswer.freeFormInput }
            : {}),
    })
}

function submitRoleAnswer({
    roleAnswer,
    onAnswered,
}: {
    roleAnswer: UserSurveyRoleAnswer
    onAnswered: (roleAnswer: UserSurveyRoleAnswer) => void
}) {
    logRoleSubmit({
        surveyName: USER_SURVEY_NAME,
        responseId,
        roleAnswer,
    })
    onAnswered(roleAnswer)
}

function buildListRoleAnswer({
    experimentArm,
    selectedOptionId,
    otherInput,
    options,
}: {
    experimentArm: "long-list" | "short-list"
    selectedOptionId: string | null
    otherInput: string
    options: readonly { id: string; label: string }[]
}): UserSurveyRoleAnswer | undefined {
    if (selectedOptionId === null) return undefined

    const selectedOption = getSelectedOptionMeta(selectedOptionId, options)
    if (!selectedOption) return undefined

    const freeFormInput = getFreeFormInput(selectedOptionId, otherInput)
    return {
        experimentArm,
        freeFormInput,
        optionId: selectedOptionId,
        optionLabel: selectedOption.optionLabel,
        optionIndex: selectedOption.optionIndex,
    }
}

function UserSurveyDialog({
    className,
    title,
    onDismiss,
    children,
}: {
    className: string
    title: string
    onDismiss: () => void
    children: ReactNode
}) {
    return (
        <aside
            className={cx("user-survey", className)}
            role="region"
            aria-labelledby={USER_SURVEY_TITLE_ID}
        >
            <div className="user-survey__header">
                <h3 id={USER_SURVEY_TITLE_ID} className="user-survey__title">
                    {title}
                </h3>
                <Button
                    className="user-survey__close-button"
                    theme="outline-light-blue"
                    onClick={onDismiss}
                    ariaLabel="Close"
                    icon={faXmark}
                />
            </div>
            {children}
        </aside>
    )
}

function UserSurveyDebugPanel({
    selectedArm,
    isDismissed,
    onArmChange,
    onReset,
}: {
    selectedArm: ExperimentArm
    isDismissed: boolean
    onArmChange: (arm: ExperimentArm) => void
    onReset: () => void
}) {
    return (
        <aside className="user-survey-debug" role="region">
            <label
                className="user-survey-debug__label"
                htmlFor="user-survey-debug-arm-select"
            >
                Survey debug arm
            </label>
            <div className="user-survey-debug__controls">
                <select
                    id="user-survey-debug-arm-select"
                    className="user-survey-debug__select"
                    value={selectedArm}
                    onChange={(event) => {
                        const value = event.target.value
                        if (
                            value === "long-list" ||
                            value === "short-list" ||
                            value === "free-form"
                        ) {
                            onArmChange(value)
                        }
                    }}
                >
                    {EXPERIMENT_ARM_OPTIONS.map((arm) => (
                        <option key={arm} value={arm}>
                            {arm}
                        </option>
                    ))}
                </select>
                <Button
                    className="user-survey-debug__reset-button"
                    theme="outline-light-blue"
                    onClick={onReset}
                    text={isDismissed ? "Show widget" : "Reset flow"}
                    icon={null}
                />
            </div>
        </aside>
    )
}

function ThankYouStep({
    onDismiss,
    onSuccess,
    surveyName,
    responseId,
    roleAnswer,
}: {
    onDismiss: () => void
    onSuccess: () => void
    surveyName: string
    responseId: string
    roleAnswer: UserSurveyRoleAnswer
}) {
    const [feedback, setFeedback] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const isSubmitDisabled = isSubmitting || feedback.trim().length === 0
    const headingRef = useRef<HTMLHeadingElement>(null)
    useTriggerOnEscape(onDismiss)

    // Move focus to the heading on mount so screen readers announce the phase
    // transition from the role question to this thank-you step (WCAG 4.1.3).
    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    function handleSubmit() {
        const feedbackAnswer = feedback.trim()
        if (feedbackAnswer.length === 0) {
            onDismiss()
            return
        }

        setIsSubmitting(true)
        setSubmitError(null)

        void submitFeedback({
            surveyName,
            responseId,
            feedbackAnswer,
            roleAnswer,
        })
            .then(() => {
                logSurveyDebug("analytics:feedback-submit", {
                    surveyName,
                    responseId,
                    experimentArm: roleAnswer.experimentArm,
                })
                onSuccess()
            })
            .catch(() => {
                setSubmitError(
                    "Something went wrong while sending feedback. Please try again."
                )
            })
            .finally(() => {
                setIsSubmitting(false)
            })
    }

    return (
        <aside
            className="user-survey user-survey--follow-up"
            role="region"
            aria-labelledby={USER_SURVEY_FOLLOW_UP_TITLE_ID}
            aria-describedby={USER_SURVEY_FOLLOW_UP_DESCRIPTION_ID}
        >
            <div className="user-survey__follow-up-body">
                <div className="user-survey__follow-up-top-row">
                    <div className="user-survey__follow-up-checkmark">
                        <FontAwesomeIcon icon={faCheck} />
                    </div>
                    <Button
                        className="user-survey__close-button user-survey__follow-up-close-button"
                        theme="outline-light-blue"
                        onClick={onDismiss}
                        ariaLabel="Close"
                        icon={faXmark}
                    />
                </div>
                <h3
                    ref={headingRef}
                    id={USER_SURVEY_FOLLOW_UP_TITLE_ID}
                    className="user-survey__follow-up-title"
                    tabIndex={-1}
                >
                    Thank you for answering our survey.
                </h3>
                <p
                    id={USER_SURVEY_FOLLOW_UP_DESCRIPTION_ID}
                    className="user-survey__follow-up-description"
                >
                    This will help us improve our website for our users.
                </p>
                <label
                    className="user-survey__follow-up-label"
                    htmlFor={USER_SURVEY_FOLLOW_UP_INPUT_ID}
                >
                    Do you have any other feedback?
                </label>
                <textarea
                    id={USER_SURVEY_FOLLOW_UP_INPUT_ID}
                    className="user-survey__follow-up-textarea"
                    value={feedback}
                    disabled={isSubmitting}
                    maxLength={2000}
                    onChange={(event) => {
                        setFeedback(event.target.value)
                    }}
                    placeholder="Let us know here..."
                />
                {submitError && (
                    <p className="user-survey__follow-up-error" role="alert">
                        {submitError}
                    </p>
                )}
                <div className="user-survey__follow-up-actions">
                    <Button
                        className="user-survey__follow-up-no-thanks-button"
                        theme="outline-light-blue"
                        disabled={isSubmitting}
                        onClick={onDismiss}
                        text="No thanks"
                        icon={null}
                    />
                    <Button
                        className="user-survey__follow-up-submit-button"
                        theme="solid-light-blue"
                        disabled={isSubmitDisabled}
                        onClick={handleSubmit}
                        text={isSubmitting ? "Submitting..." : "Submit"}
                        icon={null}
                    />
                </div>
            </div>
        </aside>
    )
}

function ListRoleStep({
    experimentArm,
    options,
    className,
    radioButtonGroup,
    radioButtonClassName,
    onDismiss,
    onAnswered,
}: UserSurveyRoleStepProps & {
    experimentArm: "long-list" | "short-list"
    options: RoleOption[]
    className: string
    radioButtonGroup: string
    radioButtonClassName?: string
}) {
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
        null
    )
    const [otherInput, setOtherInput] = useState<string>("")
    const otherInputRef = useRef<HTMLInputElement>(null)

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!isSubmitEnabled) return
        const roleAnswer = buildListRoleAnswer({
            experimentArm,
            selectedOptionId,
            otherInput,
            options,
        })
        if (!roleAnswer) return

        submitRoleAnswer({ roleAnswer, onAnswered })
    }

    const isSubmitEnabled = isValidRoleAnswer(selectedOptionId, otherInput)

    return (
        <UserSurveyDialog
            className={className}
            title="Which of the following best describes you?"
            onDismiss={onDismiss}
        >
            <Form className="user-survey__form" onSubmit={handleSubmit}>
                <fieldset className="user-survey__fieldset">
                    <legend className="user-survey__legend">I am a:</legend>
                    <div className="user-survey__options">
                        {options.map((option) => {
                            const isSelected = selectedOptionId === option.id

                            return (
                                <div
                                    className="user-survey__option"
                                    key={option.id}
                                >
                                    <RadioButton
                                        className={cx(
                                            "user-survey__radio-button",
                                            radioButtonClassName
                                        )}
                                        id={`user-survey-${radioButtonGroup}-${option.id}`}
                                        group={radioButtonGroup}
                                        checked={isSelected}
                                        onChange={() =>
                                            setSelectedOptionId(option.id)
                                        }
                                        label={
                                            option.description ? (
                                                <span className="user-survey__option-text">
                                                    <span className="user-survey__option-title">
                                                        {option.label}
                                                    </span>
                                                    <span className="user-survey__option-description">
                                                        {option.description}
                                                    </span>
                                                </span>
                                            ) : (
                                                option.label
                                            )
                                        }
                                    />
                                    {option.hasInlineInput && (
                                        <div className="user-survey__other-input-wrapper">
                                            <input
                                                ref={otherInputRef}
                                                className="user-survey__other-input"
                                                type="text"
                                                value={otherInput}
                                                maxLength={200}
                                                onFocus={() => {
                                                    setSelectedOptionId(
                                                        option.id
                                                    )
                                                }}
                                                onChange={(event) => {
                                                    setSelectedOptionId(
                                                        option.id
                                                    )
                                                    setOtherInput(
                                                        event.target.value
                                                    )
                                                }}
                                                placeholder="Please specify..."
                                                aria-label="Please specify"
                                            />
                                            {otherInput.length > 0 && (
                                                <button
                                                    className="user-survey__other-input-clear-button"
                                                    type="button"
                                                    onClick={() => {
                                                        setOtherInput("")
                                                        setSelectedOptionId(
                                                            option.id
                                                        )
                                                        otherInputRef.current?.focus()
                                                    }}
                                                    aria-label="Clear other details"
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faCircleXmark}
                                                    />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    <div
                        className={cx("user-survey__submit-row", {
                            "user-survey__submit-row--sticky":
                                selectedOptionId !== null,
                        })}
                    >
                        <Button
                            className="user-survey__submit-button"
                            type="submit"
                            disabled={!isSubmitEnabled}
                            text="Submit"
                            theme="solid-light-blue"
                            icon={null}
                        />
                    </div>
                </fieldset>
            </Form>
        </UserSurveyDialog>
    )
}

function FreeFormRoleStep({ onDismiss, onAnswered }: UserSurveyRoleStepProps) {
    const [value, setValue] = useState<string>("")

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!isSubmitEnabled) return
        const freeFormInput = value.trim()
        const roleAnswer: UserSurveyRoleAnswer = {
            experimentArm: "free-form",
            freeFormInput,
        }
        submitRoleAnswer({ roleAnswer, onAnswered })
    }

    const isSubmitEnabled = value.trim().length > 0

    return (
        <UserSurveyDialog
            className="user-survey--free-form"
            title="How would you describe your main occupation?"
            onDismiss={onDismiss}
        >
            <Form className="user-survey__short-form" onSubmit={handleSubmit}>
                <div className="user-survey__short-body">
                    <label
                        className="user-survey__short-legend"
                        htmlFor={USER_SURVEY_FREE_FORM_INPUT_ID}
                    >
                        I am a:
                    </label>
                    <input
                        id={USER_SURVEY_FREE_FORM_INPUT_ID}
                        className="user-survey__free-input"
                        type="text"
                        value={value}
                        maxLength={200}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="eg. journalist, policy professional, educator..."
                    />
                    <Button
                        className="user-survey__submit-button"
                        type="submit"
                        disabled={!isSubmitEnabled}
                        text="Submit"
                        theme="solid-light-blue"
                        icon={null}
                    />
                </div>
            </Form>
        </UserSurveyDialog>
    )
}

export default function UserSurvey() {
    const [activeExperimentArm, setActiveExperimentArm] =
        useState<ExperimentArm>(DEBUG_DEFAULT_EXPERIMENT_ARM)
    const [roleAnswer, setRoleAnswer] = useState<UserSurveyRoleAnswer | null>(
        null
    )
    const [isDismissed, setIsDismissed] = useState<boolean>(false)

    useEffect(() => {
        if (isDismissed) return

        if (roleAnswer === null) {
            logSurveyDebug("analytics:role-show", {
                surveyName: USER_SURVEY_NAME,
                responseId,
                experimentArm: activeExperimentArm,
            })
            return
        }

        logSurveyDebug("analytics:thank-you-show", {
            surveyName: USER_SURVEY_NAME,
            responseId,
            experimentArm: activeExperimentArm,
        })
    }, [activeExperimentArm, isDismissed, roleAnswer])

    function handleRoleAnswered(answer: UserSurveyRoleAnswer) {
        setRoleAnswer(answer)
        markUserSurveyAnswered()
        logSurveyDebug("state:answered", { responseId, answer })
    }

    function handleDismiss() {
        if (!roleAnswer) {
            markUserSurveyDismissed()
            logSurveyDebug("analytics:role-dismiss", {
                surveyName: USER_SURVEY_NAME,
                responseId,
                experimentArm: activeExperimentArm,
            })
        } else {
            logSurveyDebug("analytics:thank-you-dismiss", {
                surveyName: USER_SURVEY_NAME,
                responseId,
                experimentArm: activeExperimentArm,
            })
        }
        setIsDismissed(true)
    }

    function handleExperimentArmChange(arm: ExperimentArm) {
        setActiveExperimentArm(arm)
        setRoleAnswer(null)
        setIsDismissed(false)
        logSurveyDebug("state:experiment-arm-change", { responseId, arm })
    }

    function handleResetFlow() {
        setRoleAnswer(null)
        setIsDismissed(false)
        logSurveyDebug("state:reset", {
            responseId,
            experimentArm: activeExperimentArm,
        })
    }

    const surveyWidget =
        roleAnswer !== null ? (
            <ThankYouStep
                onDismiss={handleDismiss}
                onSuccess={() => {
                    setIsDismissed(true)
                }}
                surveyName={USER_SURVEY_NAME}
                responseId={responseId}
                roleAnswer={roleAnswer}
            />
        ) : (
            match(activeExperimentArm)
                .with("long-list", () => (
                    <ListRoleStep
                        experimentArm="long-list"
                        options={LONG_LIST_OPTIONS}
                        className="user-survey--long-list"
                        radioButtonGroup="user-survey-long-role"
                        onDismiss={handleDismiss}
                        onAnswered={handleRoleAnswered}
                    />
                ))
                .with("short-list", () => (
                    <ListRoleStep
                        experimentArm="short-list"
                        options={SHORT_LIST_OPTIONS}
                        className="user-survey--short-list"
                        radioButtonGroup="user-survey-short-role"
                        radioButtonClassName="user-survey__radio-button--short-list"
                        onDismiss={handleDismiss}
                        onAnswered={handleRoleAnswered}
                    />
                ))
                .with("free-form", () => (
                    <FreeFormRoleStep
                        onDismiss={handleDismiss}
                        onAnswered={handleRoleAnswered}
                    />
                ))
                .exhaustive()
        )

    return (
        <>
            <UserSurveyDebugPanel
                selectedArm={activeExperimentArm}
                isDismissed={isDismissed}
                onArmChange={handleExperimentArmChange}
                onReset={handleResetFlow}
            />
            {!isDismissed && surveyWidget}
        </>
    )
}
