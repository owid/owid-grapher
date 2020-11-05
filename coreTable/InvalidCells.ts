// Previously when we get a blank for a value, or a string where we expect a number, etc, we parse things as simply
// undefineds or nulls or NaN.
// Since authors are uploading data from our sources at runtime, and errors in source data are extremely common,
// it may be helpful to parse those invalid values into specific types, to provide better error messages
// and perhaps in the future suggested autocorrections or workarounds. Or this could be a dumb idea and can be discarded.
export abstract class InvalidCell {
    toString() {
        return ""
    }
    toErrorString() {
        return this.constructor.name
    }
}

class NaNButShouldBeNumber extends InvalidCell {}
class DroppedForTesting extends InvalidCell {}
class InvalidOnALogScale extends InvalidCell {}
class UndefinedButShouldBeNumber extends InvalidCell {}
class NullButShouldBeNumber extends InvalidCell {}
class BlankButShouldBeNumber extends InvalidCell {}
class UndefinedButShouldBeString extends InvalidCell {}
class NullButShouldBeString extends InvalidCell {}
class NotAParseableNumberButShouldBeNumber extends InvalidCell {}
class MissingValuePlaceholder extends InvalidCell {}
class DivideByZeroError extends InvalidCell {}
class NoValueWithinTolerance extends InvalidCell {}
class NoMatchingValueAfterJoin extends InvalidCell {}
class ValueTooLow extends InvalidCell {}
class NoValueToCompareAgainst extends InvalidCell {}
class FilteredValue extends InvalidCell {}
class NoValueForInterpolation extends InvalidCell {}

export const InvalidCellTypes = {
    NaNButShouldBeNumber: new NaNButShouldBeNumber(),
    DroppedForTesting: new DroppedForTesting(),
    InvalidOnALogScale: new InvalidOnALogScale(),
    UndefinedButShouldBeNumber: new UndefinedButShouldBeNumber(),
    NullButShouldBeNumber: new NullButShouldBeNumber(),
    BlankButShouldBeNumber: new BlankButShouldBeNumber(),
    UndefinedButShouldBeString: new UndefinedButShouldBeString(),
    NullButShouldBeString: new NullButShouldBeString(),
    MissingValuePlaceholder: new MissingValuePlaceholder(),
    NotAParseableNumberButShouldBeNumber: new NotAParseableNumberButShouldBeNumber(),
    DivideByZeroError: new DivideByZeroError(),
    NoValueWithinTolerance: new NoValueWithinTolerance(),
    NoMatchingValueAfterJoin: new NoMatchingValueAfterJoin(),
    ValueTooLow: new ValueTooLow(),
    NoValueToCompareAgainst: new NoValueToCompareAgainst(),
    FilteredValue: new FilteredValue(),
    NoValueForInterpolation: new NoValueForInterpolation(),
}

// https://github.com/robertmassaioli/ts-is-present
// A predicate for filtering an array of valid and invalid cells that returns the correct type
export const isValid = <TYPE>(item: TYPE | InvalidCell): item is TYPE =>
    !(item instanceof InvalidCell)
