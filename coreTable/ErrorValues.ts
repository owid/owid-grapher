/**
 * Previously when we get a blank for a value, or a string where we expect a number, etc,
 * we parse things as simply undefineds or nulls or NaN. Since authors are uploading data
 * from our sources at runtime, and errors in source data are extremely common, it may be helpful
 * to parse those invalid values into specific types, to provide better error message and perhaps
 * in the future suggested autocorrections or workarounds.
 *
 * For a good read on the "Errors are values" pattern: https://blog.golang.org/errors-are-values
 */
export abstract class ErrorValue {
    toString() {
        return ""
    }
    toErrorString() {
        return this.constructor.name
    }
}

class NaNButShouldBeNumber extends ErrorValue {}
class DroppedForTesting extends ErrorValue {}
class InvalidOnALogScale extends ErrorValue {}
class UndefinedButShouldBeNumber extends ErrorValue {}
class NullButShouldBeNumber extends ErrorValue {}
class BlankButShouldBeNumber extends ErrorValue {}
class UndefinedButShouldBeString extends ErrorValue {}
class NullButShouldBeString extends ErrorValue {}
class NotAParseableNumberButShouldBeNumber extends ErrorValue {}
class MissingValuePlaceholder extends ErrorValue {}
class DivideByZeroError extends ErrorValue {}
class NoValueWithinTolerance extends ErrorValue {}
class NoMatchingValueAfterJoin extends ErrorValue {}
class ValueTooLow extends ErrorValue {}
class NoValueToCompareAgainst extends ErrorValue {}
class FilteredValue extends ErrorValue {}
class NoValueForInterpolation extends ErrorValue {}

export const ErrorValueTypes = {
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
// A predicate for filtering an array of valid and error values that returns the correct type
export const isNotErrorValue = <TYPE>(item: TYPE | ErrorValue): item is TYPE =>
    !(item instanceof ErrorValue)

export const defaultIfErrorValue = <TYPE>(
    item: TYPE | ErrorValue,
    defaultValue?: TYPE
): TYPE | undefined => (isNotErrorValue(item) ? item : defaultValue)
