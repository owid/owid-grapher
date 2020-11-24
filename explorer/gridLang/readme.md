# GridLang

(Note: GridLang name is a placeholder and this readme is a stub)

GridLang is a library for building 2-dimensional domain specific languages designed to be edited in a Spreadsheet UI.

Unlike traditional computer languages that parse tokens in-order, tokens in GridLanguages are parsed in a lazy, non-linear manner, based upon there position in a 2-d matrix.

Our "Explorer"—a DSL for building OWID explorers and Graphers—is a GridLang.

GridLangs are also intrinsically "patchable"—a great way for perserving user state.

## How it works

1. Extend the base GridProgram class with a class for your new DSL.
2. Create a grammar for your DSL.
3. Load in some "programs" from TSVs.

## Patch: encoding all Query Params as a single TSV document

Patch is a simple design pattern for allowing users to easily store all their state—"just throw it in the patch"!

Quick example:

Instead of turning this:

```json
{
    "selection": ["USA", "Canada"],
    "year": 2000,
    "tab": "map"
}
```

into this:

```
country=USA~Canada&year=2000&tab=map
```

Turn this:

```tsv
selection	USA	Canada
year	2000
tab	map
```

into this:

```
patch=selection=USA=Canada~year=2000~tab=map
```

Tabs become "="
Newlines become "~"

(But you can set those yourself: patchNewline=~, patchTab==)

## Benefits

1. A single place to encode and decode your params. Just encode/decode the whole patch. Do not decode/encode N times for every parameter nor invent a special encoding scheme for each param.
2. Cleanly encodes arrays and nested structures.
3. Same human readability (and greatly improved readbility for complex params).
4. Versioning with easy upgrading.
5. Very easy to debug—it's just a patch!

## How to use

1. Patch comes in handy when you have GridLangs that:

-   have state
-   that the user can change
-   that the user should be able to take with them and rehydrate the class with

2. Bind your patch to the window.

## Versioning

Just use semantic versioning, only caring about breaking changes so only a major version:

patchVersion=2&patch=...
