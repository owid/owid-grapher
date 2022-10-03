# SelectionArray

The browser already has a class named `Selection`, so for now we have `SelectionArray`.

This is a pretty simple class that maintains 2 arrays:

1. An array of strings which contains the names and or codes of selected entities
2. An array of Entities that can be selected

If something happens so the user has new choices, you can expand #2.

## Wish list

Except for Scatters, only selected entities will appear in charts. In Scatters "selected entities" really are "highlighted entities". It may be nice to separate those concepts.

SeriesSelection. It may be better to rename OwidTable to TimeSeriesTable, and remove the concept of `entityName` and replace with `seriesName`. Then we could have a nice simple concept "SeriesSelection". Similarly, we could ditch "EntityCode" and maybe have "SeriesNickname", which would be a shorter URL friendly way to specify seriesSelection. It would then be nice to rename the `country=` url param to something like `series=`
