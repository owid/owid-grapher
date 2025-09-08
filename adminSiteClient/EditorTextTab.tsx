import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { LogoOption, RelatedQuestionsConfig } from "@ourworldindata/types"
import { getErrorMessageRelatedQuestionUrl } from "@ourworldindata/grapher"
import { copyToClipboard, slugify } from "@ourworldindata/utils"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { isChartEditorInstance } from "./ChartEditor.js"
import {
    AutoTextField,
    BindAutoStringExt,
    BindString,
    Button,
    RadioGroup,
    Section,
    TextField,
    Toggle,
} from "./Forms.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ErrorMessages } from "./ChartEditorTypes.js"
import { isNarrativeChartEditorInstance } from "./NarrativeChartEditor.js"
import { Button as AntdButton, Space } from "antd"
import {
    BAKED_GRAPHER_URL,
    ADMIN_BASE_URL,
} from "../settings/clientSettings.js"

interface EditorTextTabProps<Editor> {
    editor: Editor
    errorMessages: ErrorMessages
}

@observer
export class EditorTextTab<
    Editor extends AbstractChartEditor,
> extends Component<EditorTextTabProps<Editor>> {
    constructor(props: EditorTextTabProps<Editor>) {
        super(props)
        makeObservable(this)
    }

    @action.bound onSlug(slug: string) {
        this.props.editor.grapherState.slug = slugify(slug)
    }

    @action.bound onChangeLogo(value: string) {
        if (value === "none") {
            this.props.editor.grapherState.hideLogo = true
        } else {
            this.props.editor.grapherState.hideLogo = undefined
            this.props.editor.grapherState.logo =
                (value as LogoOption) || undefined
        }
    }

    @action.bound onAddRelatedQuestion() {
        const { grapherState } = this.props.editor
        if (!grapherState.relatedQuestions) grapherState.relatedQuestions = []
        grapherState.relatedQuestions.push({
            text: "",
            url: "",
        })
    }

    @action.bound onRemoveRelatedQuestion(idx: number) {
        const { grapherState } = this.props.editor
        if (!grapherState.relatedQuestions) grapherState.relatedQuestions = []
        grapherState.relatedQuestions.splice(idx, 1)
    }

    @action.bound onToggleTitleAnnotationEntity(value: boolean) {
        const { grapherState } = this.props.editor
        grapherState.hideAnnotationFieldsInTitle ??= {}
        grapherState.hideAnnotationFieldsInTitle.entity = value || undefined
    }

    @action.bound onToggleTitleAnnotationTime(value: boolean) {
        const { grapherState } = this.props.editor
        grapherState.hideAnnotationFieldsInTitle ??= {}
        grapherState.hideAnnotationFieldsInTitle.time = value || undefined
    }

    @action.bound onToggleTitleAnnotationChangeInPrefix(value: boolean) {
        const { grapherState } = this.props.editor
        grapherState.hideAnnotationFieldsInTitle ??= {}
        grapherState.hideAnnotationFieldsInTitle.changeInPrefix =
            value || undefined
    }

    @computed get errorMessages() {
        return this.props.errorMessages
    }

    @computed get showChartSlug() {
        return !isNarrativeChartEditorInstance(this.props.editor)
    }

    @computed get showAnyAnnotationFieldInTitleToggle() {
        const { features } = this.props.editor
        return (
            features.showEntityAnnotationInTitleToggle ||
            features.showTimeAnnotationInTitleToggle ||
            features.showChangeInPrefixToggle
        )
    }

    @computed get hasCopyAdminURLButton() {
        return !!this.props.editor.grapherState.id
    }

    @computed get hasCopyGrapherURLButton() {
        return !!this.props.editor.grapherState.isPublished
    }

    override render() {
        const { editor } = this.props
        const { grapherState, features } = editor
        const { relatedQuestions = [] } = grapherState

        return (
            <div className="EditorTextTab">
                <Section name="Header">
                    <BindAutoStringExt
                        label="Title"
                        readFn={(grapherState) => grapherState.displayTitle}
                        writeFn={(grapherState, newVal) =>
                            (grapherState.title = newVal)
                        }
                        auto={
                            editor.canPropertyBeInherited("title")
                                ? editor.activeParentConfig?.title
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("title") ||
                            grapherState.title === undefined
                        }
                        store={grapherState}
                        softCharacterLimit={100}
                    />
                    {features.showEntityAnnotationInTitleToggle && (
                        <Toggle
                            label="Hide automatic entity"
                            value={
                                !!grapherState.hideAnnotationFieldsInTitle
                                    ?.entity
                            }
                            onValue={this.onToggleTitleAnnotationEntity}
                        />
                    )}
                    {features.showTimeAnnotationInTitleToggle && (
                        <Toggle
                            label="Hide automatic time"
                            secondaryLabel={
                                "grapherState makes sure to include the current time in the title if " +
                                "omitting it would lead to SVG exports with no reference " +
                                "to the time. In such cases, your preference is ignored."
                            }
                            value={
                                !!grapherState.hideAnnotationFieldsInTitle?.time
                            }
                            onValue={this.onToggleTitleAnnotationTime}
                        />
                    )}
                    {features.showChangeInPrefixToggle && (
                        <Toggle
                            label="Don't prepend 'Change in' in relative line charts"
                            value={
                                !!grapherState.hideAnnotationFieldsInTitle
                                    ?.changeInPrefix
                            }
                            onValue={this.onToggleTitleAnnotationChangeInPrefix}
                        />
                    )}
                    {this.showAnyAnnotationFieldInTitleToggle && <hr />}
                    {this.showChartSlug && (
                        <AutoTextField
                            label="/grapher/"
                            value={grapherState.displaySlug}
                            onValue={this.onSlug}
                            isAuto={grapherState.slug === undefined}
                            onToggleAuto={() =>
                                (grapherState.slug =
                                    grapherState.slug === undefined
                                        ? grapherState.displaySlug
                                        : undefined)
                            }
                            helpText="Human-friendly URL for this chart"
                        />
                    )}
                    <BindAutoStringExt
                        label="Subtitle"
                        readFn={(grapherState) => grapherState.currentSubtitle}
                        writeFn={(grapherState, newVal) =>
                            (grapherState.subtitle = newVal)
                        }
                        auto={
                            editor.canPropertyBeInherited("subtitle")
                                ? editor.activeParentConfig?.subtitle
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("subtitle") ||
                            grapherState.subtitle === undefined
                        }
                        store={grapherState}
                        placeholder="Briefly describe the context of the data. It's best to avoid duplicating any information which can be easily inferred from other visual elements of the chart."
                        textarea
                        softCharacterLimit={280}
                        errorMessage={this.errorMessages.subtitle}
                    />
                    <RadioGroup
                        label="Logo"
                        options={[
                            { label: "OWID", value: "owid" },
                            { label: "CORE+OWID", value: "core+owid" },
                            { label: "GV+OWID", value: "gv+owid" },
                            { label: "No logo", value: "none" },
                        ]}
                        value={
                            grapherState.hideLogo
                                ? "none"
                                : grapherState.logo || "owid"
                        }
                        onChange={this.onChangeLogo}
                    />
                </Section>
                <Section name="Footer">
                    <BindAutoStringExt
                        label="Source"
                        readFn={(grapherState) => grapherState.sourcesLine}
                        writeFn={(grapherState, newVal) =>
                            (grapherState.sourceDesc = newVal)
                        }
                        auto={
                            editor.canPropertyBeInherited("sourceDesc")
                                ? editor.activeParentConfig?.sourceDesc
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("sourceDesc") ||
                            grapherState.sourceDesc === undefined
                        }
                        store={grapherState}
                        helpText="Short comma-separated list of source names"
                        softCharacterLimit={60}
                    />
                    <BindString
                        label="Origin url"
                        field="originUrl"
                        store={grapherState}
                        placeholder={"e.g. /poverty"}
                        helpText="The page containing this chart where more context can be found. Both relative and absolute URLs are accepted."
                    />
                    {isChartEditorInstance(editor) &&
                        editor.references &&
                        (editor.references.postsWordpress?.length ||
                            editor.references.postsGdocs?.length) && (
                            <div className="originSuggestions">
                                <p>Origin url suggestions</p>
                                <ul>
                                    {[
                                        ...(editor.references.postsWordpress ??
                                            []),
                                        ...(editor.references.postsGdocs ?? []),
                                    ].map((post) => (
                                        <li key={post.id}>{post.url}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                    <BindAutoStringExt
                        label="Footer note"
                        readFn={(grapherState) => grapherState.note ?? ""}
                        writeFn={(grapherState, newVal) =>
                            (grapherState.note = newVal)
                        }
                        auto={
                            editor.canPropertyBeInherited("note")
                                ? editor.activeParentConfig?.note
                                : undefined
                        }
                        isAuto={editor.isPropertyInherited("note")}
                        store={grapherState}
                        helpText="Any important clarification needed to avoid miscommunication"
                        softCharacterLimit={140}
                        errorMessage={this.errorMessages.note}
                        textarea
                    />
                </Section>

                <Section name="Related">
                    {relatedQuestions.map(
                        (question: RelatedQuestionsConfig, idx: number) => (
                            <div key={idx}>
                                <TextField
                                    label="Related question"
                                    value={question.text}
                                    onValue={action((value: string) => {
                                        question.text = value
                                    })}
                                    placeholder="e.g. How did countries respond to the pandemic?"
                                    helpText="Short question promoting exploration of related content"
                                    softCharacterLimit={50}
                                />
                                {question.text && (
                                    <TextField
                                        label="URL"
                                        value={question.url}
                                        onValue={action((value: string) => {
                                            question.url = value
                                        })}
                                        placeholder="e.g. https://ourworldindata.org/coronavirus"
                                        helpText="Page or section of a page where the answer to the previous question can be found."
                                        errorMessage={getErrorMessageRelatedQuestionUrl(
                                            question
                                        )}
                                    />
                                )}
                                <Button
                                    onClick={() =>
                                        this.onRemoveRelatedQuestion(idx)
                                    }
                                >
                                    <FontAwesomeIcon icon={faMinus} /> Remove
                                    related question
                                </Button>
                            </div>
                        )
                    )}
                    {!relatedQuestions.length && (
                        <Button onClick={this.onAddRelatedQuestion}>
                            <FontAwesomeIcon icon={faPlus} /> Add related
                            question
                        </Button>
                    )}
                </Section>
                <Section name="Misc">
                    <BindString
                        label="Internal author notes"
                        field="internalNotes"
                        store={grapherState}
                        placeholder="e.g. WIP, needs review, etc"
                        textarea
                    />
                    <BindString
                        label="Variant name"
                        field="variantName"
                        store={grapherState}
                        placeholder="e.g. IHME"
                        helpText="Optional variant name for distinguishing charts with the same title"
                    />
                </Section>
                {(this.hasCopyAdminURLButton ||
                    this.hasCopyGrapherURLButton) && (
                    <Section name="Copy as Markdown">
                        <Space direction="vertical" size="small">
                            {this.hasCopyAdminURLButton && (
                                <AntdButton
                                    onClick={() =>
                                        copyToClipboard(
                                            `[${grapherState.title}](${ADMIN_BASE_URL}/admin/charts/${grapherState.id}/edit)`
                                        )
                                    }
                                >
                                    Copy admin URL
                                </AntdButton>
                            )}
                            {this.hasCopyGrapherURLButton && (
                                <AntdButton
                                    onClick={() =>
                                        copyToClipboard(
                                            `[${grapherState.title}](${BAKED_GRAPHER_URL}/${grapherState.slug})`
                                        )
                                    }
                                >
                                    Copy Grapher URL
                                </AntdButton>
                            )}
                        </Space>
                    </Section>
                )}
            </div>
        )
    }
}
