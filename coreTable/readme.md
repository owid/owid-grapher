# CoreTable

This is our core tabular data structure class which parses JSON or delimited data and makes it available for charts. This class performs core transformations like filtering, grouping, etc. This is roughly our "Pandas for TypeScript".

## Context

TypeScript/Javascript does not have a builtin tabular data structure, nor does it have a "standard" data table package like Pandas in Python or Data.Tables/Tibbles in R.

A library like that is essential for powering common data transformations including grouping, filtering, joining, pivots (group and reduce) and computed columns.

In order to allow our users to interact with our charts and allow our authors to easily create computed columns for charts, we need a library like this.

## Alternatives

One alternative is to only do transforms server side, in Python or R. Previously nearly all transforms were done by authors on their machines and the results uploaded to our backend. This can be time consuming, error prone, opaque, and does not allow for rich data exploration for the reader.

Another alternative is to use someone else's package. Most commerical web data studios likely have their own internal or ad hoc data table library. AFAIK there isn't a compelling open source one yet supported by a major organization. Two interesting open source projects to watch are [Data Forge](http://github.com/data-forge/data-forge-ts) and [DataFrame-js](https://github.com/Gmousse/dataframe-js). Over the past decade, a number of "data frames in JS" packages have started but not continued (like https://github.com/StratoDem/pandas-js, https://github.com/osdat/jsdataframe, https://github.com/nickslevine/zebras and https://github.com/davidguttman/node-dataframe). As we develop this package we should keep in mind that at some point we will likely migrate to someone else's effort.

Update: Arquero (https://github.com/uwdata/arquero) looks like a promising new alternative

## Concepts

### Tables

Tables are just traditional tables with rows and columns. Currently storage is row based and columns are generated on the fly, but likely we will inverse that.

Below is an example CoreTable, pretty printed with `table.dump()`:

```
 entityName entityId entityCode year   people time
Afghanistan       15        AFG 2001 18972552 2001
    Albania       16        ALB 2001  1753479 2001
    Algeria       17        DZA 2001  3892153 2001
    Andorra       18        AND 2001        0 2001
     Angola       19        AGO 2001 10536418 2001
```

Tables are immutable, so all transformations generate a new lightweight table. With Mobx, changes made to a parent table can regenerate the line of child tables.

### Columns

In addition to access methods, columns provide methods for parsing and displaying values.

#### Column Types

Javascript gives us just a handful of types to work with, so we build our own type hierarchy on top of that. See `ColumnTypeMap` for the available types.

#### Column Definitions

Ideally when instantiating a table you provide the column definition information needed to correctly parse and display values. CoreTable will attempt to autodetect a column definition if not provided, but results are not guaranteed. The most important piece of information after the `slug` is the column type, as explained above.

### CoreRow

CoreRow is just a Javascript object with string indexes. It doesn't really do anything at the moment. Just for distinguishing a row from any other Javascript object. It can be extended to provide stronger typing on rows.

### InvalidCell

There are a lot of situations where we have invalid values. Values might be missing in our datasets. They might be strings where numbers are expected. They might be zeros or negatives when log-friendly numbers are expected. Usually it is during first parse, but it could be downstream in the transforms. For instance, a computed column might use another column as a divisor. A zero in the first column might be find initially, but the result of the transformation would be invalid.

Generally we want to handle these errors gracefully. Therefore, instead of using the two uninformative `null` and `undefined` as error types, we have the class `InvalidCell`, and we have many variations of that class to represent different types of errors that can occur. These errors are kept in-place in the user's table (though generally filtered in all Grapher charts) for ease of auditing the operations.

### OwidTable and OwidRow

CoreTable is a general purpose class operating on any kind of table. OwidTable is a subclass of CoreTable, with the distinction that every OwidTable has an entity (aka country) column, a time integer ( year, day, quarter, etc) column, and one or more value columns. OwidTable also includes additional meta data like Source info, needed by our charts. Most of our charts are built for country changes over time, so take an OwidTable specifically.

In our case all our tables have a common shape with an entityName column, a time column, and 1+ value columns of various types. (Our tables also have EntityCode and EntityId columns, but those can be deprecated).
We also perform common transformations that make sense on tables with our shape but not on tables of other shapes. Thus we subclass CoreTable and CoreRow. OwidRow extends CoreRow and provides stronger typing on row level operations.

The split between CoreTable and OwidTable is also to ensure we minimize the delta between our data model and the common model in data science, with the bet that this may require use to maintain a lot less code in the long run.

## Additional Design Notes

-   Consolidating our transform code and switching from a variable model to a table model is a work-in-progress so currently there is still some legacy code to be removed.
-   This library should treat Node and the Browser both as first class targets. Even though our primary usage will be in the browser, ensuring a great Node experience will ensure a fast headless testing experience. We may also use this in a headless environment for running the same transform code on bigger datasets.
-   Because our clients are reactive, we are using Mobx in this library. No reason that needs to be a hard dependency here if we remove that.
-   At some point we may want to look into integrating with Apache Arrow JS (https://github.com/apache/arrow/tree/master/js).
-   Similarly for speed we may want to look into integrating/learning from CrossFilter (https://github.com/crossfilter/crossfilter).
-   Table "Sythensizers" are also included for rapid testing. The word Synthesis is used as in "Program Synthesis".
