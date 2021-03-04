import { observable, computed, action } from "mobx"
import { queryParamsToStr } from "../clientUtils/urls/UrlUtils"
import { differenceObj, trimObject } from "../clientUtils/Util"
import { ColumnTypeNames } from "../coreTable/CoreColumnDef"
import { CoreTable } from "../coreTable/CoreTable"
import {
    detectDelimiter,
    parseDelimited,
    isCellEmpty,
} from "../coreTable/CoreTableUtils"
import { GridBoolean } from "../gridLang/GridLangConstants"
import {
    ChoiceMap,
    ChoiceName,
    ChoiceValue,
    ExplorerChoice,
    ExplorerChoiceOption,
    ExplorerChoiceParams,
    ExplorerControlType,
    ExplorerControlTypeRegex,
} from "./ExplorerConstants"
import { trimAndParseObject } from "./ExplorerProgram"
import { GrapherGrammar } from "./GrapherGrammar"

// todo: cleanup
const makeChoicesMap = (delimited: string) => {
    const headerLine = delimited.split("\n")[0]
    const map = new Map<ChoiceName, ExplorerControlType>()
    headerLine
        .split(detectDelimiter(headerLine))
        .filter((name) => ExplorerControlTypeRegex.test(name))
        .forEach((choiceNameAndType) => {
            const words = choiceNameAndType.split(" ")
            const [choiceName, choiceType] = [
                words.slice(0, -1).join(" "),
                words[words.length - 1],
            ]
            map.set(choiceName as ChoiceName, choiceType as ExplorerControlType)
        })
    return map
}

// This strips the "Dropdown" or "Checkbox" from "SomeChoice Dropdown" or "SomeChoice Checkbox"
const removeChoiceControlTypeInfo = (label: string) =>
    label.replace(ExplorerControlTypeRegex, "")

const dropColumnTypes = (delimited: string): string => {
    const rows = delimited.split("\n")
    const delimiter = detectDelimiter(rows[0])
    rows[0] = rows[0]
        .split(delimiter)
        .map(removeChoiceControlTypeInfo)
        .join(delimiter)
    return rows.join("\n")
}

const makeCheckBoxOption = (
    options: ExplorerChoiceOption[],
    choiceName: string
) => {
    const checked = options.some(
        (option) => option.checked === true && option.value === GridBoolean.true
    )

    const available =
        new Set(options.filter((opt) => opt.available).map((opt) => opt.label))
            .size === 2
    return [
        {
            label: choiceName,
            checked,
            value: GridBoolean.true,
            available,
        } as ExplorerChoiceOption,
    ]
}

// Takes the author's program and the user's current settings and returns an object for
// allow the user to navigate amongst charts.
export class DecisionMatrix {
    private table: CoreTable
    @observable currentParams: ExplorerChoiceParams = {}
    constructor(delimited: string, hash = "") {
        this.choices = makeChoicesMap(delimited)
        this.table = new CoreTable(parseDelimited(dropColumnTypes(delimited)), [
            // todo: remove col def?
            {
                slug: GrapherGrammar.grapherId.keyword,
                type: ColumnTypeNames.Integer,
            },
        ])
        this.hash = hash
        this.setValuesFromChoiceParams() // Initialize options
    }

    allDecisionsAsQueryParams(): ExplorerChoiceParams[] {
        return this.table.rows.map((row) => {
            const choiceParams: ExplorerChoiceParams = {}
            this.choiceNames.forEach((name) => {
                choiceParams[name] = row[name]
            })
            return choiceParams
        })
    }

    get numRows() {
        return this.table.numRows
    }

    get requiredGrapherIds() {
        return this.table.get(GrapherGrammar.grapherId.keyword).uniqValues
    }

    private choices: Map<ChoiceName, ExplorerControlType>
    hash: string

    toConstrainedOptions(): ExplorerChoiceParams {
        const settings = { ...this.currentParams }
        this.choiceNames.forEach((choiceName) => {
            if (!this.isOptionAvailable(choiceName, settings[choiceName])) {
                settings[choiceName] = this.firstAvailableOptionForChoice(
                    choiceName,
                    settings
                )!
            }
        })
        return settings
    }

    @computed
    private get diffBetweenUserSettingsAndConstrained(): ExplorerChoiceParams {
        return differenceObj(
            this.toConstrainedOptions(),
            this.currentParams
        ) as ExplorerChoiceParams
    }

    @action.bound setValueCommand(choiceName: ChoiceName, value: ChoiceValue) {
        const currentInvalidState = this.diffBetweenUserSettingsAndConstrained
        this._setValue(choiceName, value)
        const newInvalidState = this.diffBetweenUserSettingsAndConstrained
        Object.keys(currentInvalidState).forEach((key) => {
            /**
             * The user navigated to an invalid state. Then they made a change in the new state, but the old invalid props were still set. At this
             * point, we should delete the old invalid props. We only want to allow the user to go back 1, not a full undo/redo history.
             */
            if (currentInvalidState[key] === newInvalidState[key]) {
                this._setValue(key, currentInvalidState[key])
            }
        })
    }

    @action.bound private _setValue(
        choiceName: ChoiceName,
        value: ChoiceValue
    ) {
        if (value === "") delete this.currentParams[choiceName]
        else this.currentParams[choiceName] = value
        this.selectedRow = trimAndParseObject(
            this.table.rowsAt([this.selectedRowIndex])[0],
            GrapherGrammar
        )
    }

    @action.bound setValuesFromChoiceParams(
        choiceParams: ExplorerChoiceParams = {}
    ) {
        this.choiceNames.forEach((choiceName) => {
            if (choiceParams[choiceName] === undefined)
                this._setValue(
                    choiceName,
                    this.firstAvailableOptionForChoice(choiceName)!
                )
            else this._setValue(choiceName, choiceParams[choiceName]!)
        })
        return this
    }

    @computed private get choiceNames(): ChoiceName[] {
        return Array.from(this.choices.keys())
    }

    @computed private get allChoiceOptions(): ChoiceMap {
        const choiceMap: ChoiceMap = {}
        this.choiceNames.forEach((choiceName) => {
            choiceMap[choiceName] = this.table
                .get(choiceName)
                .uniqValues.filter((cell) => !isCellEmpty(cell)) as string[]
        })
        return choiceMap
    }

    private firstAvailableOptionForChoice(
        choiceName: ChoiceName,
        currentState = this.currentParams
    ): ChoiceValue | undefined {
        return this.allChoiceOptions[choiceName].find((option) =>
            this.isOptionAvailable(choiceName, option, currentState)
        )
    }

    /**
     * Note: there is a rare bug in here + rowsWith when an author has a complex decision matrix. If the user vists a url
     * with invalid options like Metric="Tests", Interval="Weekly", Aligned="false"
     * we will return first match, which is B1, even though B2 is a better match.
     *
     * graphers
     * title	Metric Radio	Interval Radio	Aligned Checkbox
     * A1	Cases	Cumulative	true
     * A2	Cases	Cumulative	false
     * A3	Cases	Weekly	false
     *
     * B1	Tests	Cumulative	true
     * B2	Tests	Cumulative	false
     */
    isOptionAvailable(
        choiceName: ChoiceName,
        option: ChoiceValue,
        currentState = this.currentParams
    ) {
        const query: ExplorerChoiceParams = {}
        this.choiceNames
            .slice(0, this.choiceNames.indexOf(choiceName))
            .forEach((name) => {
                query[name] = currentState[name]
            })
        query[choiceName] = option
        return this.rowsWith(query, choiceName).length > 0
    }

    private rowsWith(query: ExplorerChoiceParams, choiceName?: ChoiceName) {
        // We allow other options to be blank.
        const modifiedQuery: any = {}
        Object.keys(trimObject(query)).forEach((queryColumn) => {
            if (queryColumn !== choiceName)
                // Blanks are fine if we are not talking about the column of interest
                modifiedQuery[queryColumn] = [query[queryColumn], ""]
            else modifiedQuery[queryColumn] = query[queryColumn]
        })
        return this.table.findRows(modifiedQuery)
    }

    private get firstMatch() {
        const query = this.toConstrainedOptions()
        const hits = this.rowsWith(query)
        return hits[0]
    }

    get selectedRowIndex() {
        return this.firstMatch === undefined
            ? 0
            : this.table.indexOf(this.firstMatch)
    }

    @observable selectedRow: any = {}

    private toControlOption(
        choiceName: ChoiceName,
        optionName: string,
        currentValue: ChoiceValue,
        constrainedOptions: ExplorerChoiceParams
    ): ExplorerChoiceOption {
        const available = this.isOptionAvailable(
            choiceName,
            optionName,
            constrainedOptions
        )
        return {
            label: optionName,
            value: optionName,
            available,
            checked: currentValue === optionName,
        }
    }

    @computed get choicesWithAvailability(): ExplorerChoice[] {
        const selectedRow = this.selectedRow
        const constrainedOptions = this.toConstrainedOptions()
        return this.choiceNames.map((title) => {
            const value =
                selectedRow[title] !== undefined
                    ? selectedRow[title].toString()
                    : selectedRow[title]
            const options = this.allChoiceOptions[title].map((optionName) =>
                this.toControlOption(
                    title,
                    optionName,
                    value,
                    constrainedOptions
                )
            )
            const type = this.choices.get(title)!

            return {
                title,
                displayTitle: title,
                type,
                value,
                options:
                    type === ExplorerControlType.Checkbox
                        ? makeCheckBoxOption(options, title)
                        : options,
            }
        })
    }

    toString() {
        return queryParamsToStr(this.currentParams)
    }
}
