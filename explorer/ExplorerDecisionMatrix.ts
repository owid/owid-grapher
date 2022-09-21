import { observable, computed, action, makeObservable } from "mobx"
import { queryParamsToStr } from "../clientUtils/urls/UrlUtils.js"
import { differenceObj, trimObject } from "../clientUtils/Util.js"
import { ColumnTypeNames } from "../coreTable/CoreColumnDef.js"
import { CoreTable } from "../coreTable/CoreTable.js"
import {
    detectDelimiter,
    parseDelimited,
    isCellEmpty,
} from "../coreTable/CoreTableUtils.js"
import { GridBoolean } from "../gridLang/GridLangConstants.js"
import {
    ChoiceMap,
    ChoiceName,
    ChoiceValue,
    ExplorerChoice,
    ExplorerChoiceOption,
    ExplorerChoiceParams,
    ExplorerControlType,
    ExplorerControlTypeRegex,
} from "./ExplorerConstants.js"
import { trimAndParseObject } from "./ExplorerProgram.js"
import { GrapherGrammar } from "./GrapherGrammar.js"

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
    currentParams: ExplorerChoiceParams = {}
    constructor(delimited: string, hash = "") {
        makeObservable<
            DecisionMatrix,
            | "diffBetweenUserSettingsAndConstrained"
            | "_setValue"
            | "choiceNames"
            | "allChoiceOptions"
            | "availableChoiceOptions"
        >(this, {
            currentParams: observable,
            diffBetweenUserSettingsAndConstrained: computed,
            setValueCommand: action.bound,
            _setValue: action.bound,
            setValuesFromChoiceParams: action.bound,
            choiceNames: computed,
            allChoiceOptions: computed,
            availableChoiceOptions: computed,
            selectedRow: observable,
            choicesWithAvailability: computed,
        })

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
            // check if the current choice is valid with the current settings
            if (
                this.isOptionAvailable(
                    choiceName,
                    settings[choiceName],
                    settings
                )
            ) {
                // do nothing - we can use settings[choiceName] as-is
            }
            // check if the default choice is valid with the current settings
            else if (
                this.defaultSettings[choiceName] !== undefined &&
                this.isOptionAvailable(
                    choiceName,
                    this.defaultSettings[choiceName],
                    settings
                )
            ) {
                settings[choiceName] = this.defaultSettings[choiceName]
            }
            // if both are not valid, find the first valid option
            else {
                settings[choiceName] = this.firstAvailableOptionForChoice(
                    choiceName,
                    settings
                )!
            }
        })
        return settings
    }

    private get diffBetweenUserSettingsAndConstrained(): ExplorerChoiceParams {
        return differenceObj(
            this.toConstrainedOptions(),
            this.currentParams
        ) as ExplorerChoiceParams
    }

    setValueCommand(choiceName: ChoiceName, value: ChoiceValue) {
        this._setValue(choiceName, value)
        const invalidState = this.diffBetweenUserSettingsAndConstrained
        Object.keys(invalidState).forEach((key) => {
            // If a user navigates to a state where an option previously selected is not available,
            // then persist the new option, as long as it isn't the only one available.
            //
            // For example, if the user navigates from metric:Cases interval:Weekly, to
            // metric:Vaccinations, if interval:Weekly is not available for Vaccinations but other
            // (more than one) intervals are available, we will persist whichever we happen to end
            // up on.
            //
            // But if the user navigates from metric:Cases perCapita:true, to
            // metric:Share of positive tests, then the only available perCapita option is false,
            // but it isn't persisted, because the user has no other options. It's non-sensical to
            // ask for "Share of positive tests per capita", so qualitatively it's a different
            // metric, and the perCapita can just be ignored.
            //
            // We assume in every case where the user has only a single option available (therefore
            // has no choice) the option should not be persisted.
            if (this.availableChoiceOptions[key].length > 1) {
                this._setValue(key, invalidState[key])
            }
        })
    }

    private _setValue(choiceName: ChoiceName, value: ChoiceValue) {
        if (value === "") delete this.currentParams[choiceName]
        else this.currentParams[choiceName] = value
        this.selectedRow = trimAndParseObject(
            this.table.rowsAt([this.selectedRowIndex])[0],
            GrapherGrammar
        )
    }

    setValuesFromChoiceParams(choiceParams: ExplorerChoiceParams = {}) {
        this.choiceNames.forEach((choiceName) => {
            const choiceValue =
                choiceParams[choiceName] ?? this.defaultSettings[choiceName]

            if (choiceValue === undefined)
                this._setValue(
                    choiceName,
                    this.firstAvailableOptionForChoice(choiceName)!
                )
            else this._setValue(choiceName, choiceValue)
        })
        return this
    }

    private get choiceNames(): ChoiceName[] {
        return Array.from(this.choices.keys())
    }

    private get allChoiceOptions(): ChoiceMap {
        const choiceMap: ChoiceMap = {}
        this.choiceNames.forEach((choiceName) => {
            choiceMap[choiceName] = this.table
                .get(choiceName)
                .uniqValues.filter((cell) => !isCellEmpty(cell)) as string[]
        })
        return choiceMap
    }

    private get availableChoiceOptions(): ChoiceMap {
        const result: ChoiceMap = {}
        this.choiceNames.forEach((choiceName) => {
            result[choiceName] = this.allChoiceOptions[choiceName].filter(
                (option) => this.isOptionAvailable(choiceName, option)
            )
        })
        return result
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

    // The first row with defaultView column value of "true" determines the default view to use
    private get defaultSettings() {
        const hits = this.rowsWith({
            [GrapherGrammar.defaultView.keyword]: "true",
        })
        return hits[0] ?? {}
    }

    private get firstMatch() {
        const query = this.toConstrainedOptions()
        const hits = this.rowsWith(query)
        return hits[0]
    }

    get selectedRowIndex(): number {
        return this.firstMatch === undefined
            ? 0
            : this.table.indexOf(this.firstMatch)
    }

    selectedRow: any = {}

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

    get choicesWithAvailability(): ExplorerChoice[] {
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
