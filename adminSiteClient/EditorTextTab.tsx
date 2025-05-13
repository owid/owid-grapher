import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { LogoOption, RelatedQuestionsConfig } from "@ourworldindata/types"
import { getErrorMessageRelatedQuestionUrl } from "@ourworldindata/grapher"
import { copyToClipboard, slugify } from "@ourworldindata/utils"
import { action, computed } from "mobx"
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

@observer
export class EditorTextTab<
    Editor extends AbstractChartEditor,
> extends Component<{ editor: Editor; errorMessages: ErrorMessages }> {
    @action.bound onSlug(slug: string) {
        this.props.editor.grapher.slug = slugify(slug)
    }

    @action.bound onChangeLogo(value: string) {
        if (value === "none") {
            this.props.editor.grapher.hideLogo = true
        } else {
            this.props.editor.grapher.hideLogo = undefined
            this.props.editor.grapher.logo = (value as LogoOption) || undefined
        }
    }

    @action.bound onAddRelatedQuestion() {
        const { grapher } = this.props.editor
        if (!grapher.relatedQuestions) grapher.relatedQuestions = []
        grapher.relatedQuestions.push({
            text: "",
            url: "",
        })
    }

    @action.bound onRemoveRelatedQuestion(idx: number) {
        const { grapher } = this.props.editor
        if (!grapher.relatedQuestions) grapher.relatedQuestions = []
        grapher.relatedQuestions.splice(idx, 1)
    }

    @action.bound onToggleTitleAnnotationEntity(value: boolean) {
        const { grapher } = this.props.editor
        grapher.hideAnnotationFieldsInTitle ??= {}
        grapher.hideAnnotationFieldsInTitle.entity = value || undefined
    }

    @action.bound onToggleTitleAnnotationTime(value: boolean) {
        const { grapher } = this.props.editor
        grapher.hideAnnotationFieldsInTitle ??= {}
        grapher.hideAnnotationFieldsInTitle.time = value || undefined
    }

    @action.bound onToggleTitleAnnotationChangeInPrefix(value: boolean) {
        const { grapher } = this.props.editor
        grapher.hideAnnotationFieldsInTitle ??= {}
        grapher.hideAnnotationFieldsInTitle.changeInPrefix = value || undefined
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
        return !!this.props.editor.grapher.id
    }

    @computed get hasCopyGrapherURLButton() {
        return !!this.props.editor.grapher.isPublished
    }

    render() {
        const { editor } = this.props
        const { grapher, features } = editor
        const { relatedQuestions = [] } = grapher

        return (
            <div className="EditorTextTab">
                <Section name="Header">
                    <BindAutoStringExt
                        label="Title"
                        readFn={(grapher) => grapher.displayTitle}
                        writeFn={(grapher, newVal) => (grapher.title = newVal)}
                        auto={
                            editor.couldPropertyBeInherited("title")
                                ? editor.activeParentConfig!.title
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("title") ||
                            grapher.title === undefined
                        }
                        store={grapher}
                        softCharacterLimit={100}
                    />
                    {features.showEntityAnnotationInTitleToggle && (
                        <Toggle
                            label="Hide automatic entity"
                            value={
                                !!grapher.hideAnnotationFieldsInTitle?.entity
                            }
                            onValue={this.onToggleTitleAnnotationEntity}
                        />
                    )}
                    {features.showTimeAnnotationInTitleToggle && (
                        <Toggle
                            label="Hide automatic time"
                            secondaryLabel={
                                "Grapher makes sure to include the current time in the title if " +
                                "omitting it would lead to SVG exports with no reference " +
                                "to the time. In such cases, your preference is ignored."
                            }
                            value={!!grapher.hideAnnotationFieldsInTitle?.time}
                            onValue={this.onToggleTitleAnnotationTime}
                        />
                    )}
                    {features.showChangeInPrefixToggle && (
                        <Toggle
                            label="Don't prepend 'Change in' in relative line charts"
                            value={
                                !!grapher.hideAnnotationFieldsInTitle
                                    ?.changeInPrefix
                            }
                            onValue={this.onToggleTitleAnnotationChangeInPrefix}
                        />
                    )}
                    {this.showAnyAnnotationFieldInTitleToggle && <hr />}
                    {this.showChartSlug && (
                        <AutoTextField
                            label="/grapher"
                            value={grapher.displaySlug}
                            onValue={this.onSlug}
                            isAuto={grapher.slug === undefined}
                            onToggleAuto={() =>
                                (grapher.slug =
                                    grapher.slug === undefined
                                        ? grapher.displaySlug
                                        : undefined)
                            }
                            helpText="Human-friendly URL for this chart"
                        />
                    )}
                    <BindAutoStringExt
                        label="Subtitle"
                        readFn={(grapher) => grapher.currentSubtitle}
                        writeFn={(grapher, newVal) =>
                            (grapher.subtitle = newVal)
                        }
                        auto={
                            editor.couldPropertyBeInherited("subtitle")
                                ? editor.activeParentConfig!.subtitle
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("subtitle") ||
                            grapher.subtitle === undefined
                        }
                        store={grapher}
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
                            grapher.hideLogo ? "none" : grapher.logo || "owid"
                        }
                        onChange={this.onChangeLogo}
                    />
                </Section>
                <Section name="Footer">
                    <BindAutoStringExt
                        label="Source"
                        readFn={(grapher) => grapher.sourcesLine}
                        writeFn={(grapher, newVal) =>
                            (grapher.sourceDesc = newVal)
                        }
                        auto={
                            editor.couldPropertyBeInherited("sourceDesc")
                                ? editor.activeParentConfig!.sourceDesc
                                : undefined
                        }
                        isAuto={
                            editor.isPropertyInherited("sourceDesc") ||
                            grapher.sourceDesc === undefined
                        }
                        store={grapher}
                        helpText="Short comma-separated list of source names"
                        softCharacterLimit={60}
                    />
                    <BindString
                        label="Origin url"
                        field="originUrl"
                        store={grapher}
                        placeholder={grapher.originUrlWithProtocol}
                        helpText="The page containing this chart where more context can be found"
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
                        readFn={(grapher) => grapher.note ?? ""}
                        writeFn={(grapher, newVal) => (grapher.note = newVal)}
                        auto={
                            editor.couldPropertyBeInherited("note")
                                ? editor.activeParentConfig?.note
                                : undefined
                        }
                        isAuto={editor.isPropertyInherited("note")}
                        store={grapher}
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
                        store={grapher}
                        placeholder="e.g. WIP, needs review, etc"
                        textarea
                    />
                    <BindString
                        label="Variant name"
                        field="variantName"
                        store={grapher}
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
                                            `[${grapher.title}](${ADMIN_BASE_URL}/admin/charts/${grapher.id}/edit)`
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
                                            `[${grapher.title}](${BAKED_GRAPHER_URL}/${grapher.slug})`
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
