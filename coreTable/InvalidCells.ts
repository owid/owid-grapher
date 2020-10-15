// Previously when we get a blank for a value, or a string where we expect a number, etc, we parse things as simply
// undefineds or nulls or NaN.
// Since authors are uploading data from our sources at runtime, and errors in source data are extremely common,
// it may be helpful to parse those invalid values into specific types, to provide better error messages
// and perhaps in the future suggested autocorrections or workarounds. Or this could be a dumb idea and can be discarded.
export abstract class InvalidCell {
    protected invalidCellValue?: any
    constructor(invalidCellValue?: any) {
        this.invalidCellValue = invalidCellValue
    }
    toString() {
        return this.invalidCellValue instanceof InvalidCell
            ? ""
            : this.invalidCellValue ?? ""
    }
    toErrorString() {
        return this.constructor.name
    }
}
export class NaNButShouldBeNumber extends InvalidCell {
    toErrorString() {
        return this.constructor.name + `: '${this.invalidCellValue}'`
    }
}
export class DroppedForTesting extends InvalidCell {}
export class InvalidOnALogScale extends InvalidCell {}
export class UndefinedButShouldBeNumber extends InvalidCell {}
export class NullButShouldBeNumber extends InvalidCell {}
export class BlankButShouldBeNumber extends InvalidCell {}
export class UndefinedButShouldBeString extends InvalidCell {}
export class NullButShouldBeString extends InvalidCell {}
export class NotAParseableNumberButShouldBeNumber extends InvalidCell {
    toErrorString() {
        return this.constructor.name + `: '${this.invalidCellValue}'`
    }
}
