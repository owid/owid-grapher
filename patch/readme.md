# Patch: instead of query params use a TSV

Patch is a tiny immutable data structure and DSL for encoding Javascript object literals into query strings. Patch has no external dependencies.

With Patch, you design your query params so that they map to a TSV document. Then Patch encodes and decodes that document.

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
patch=selection-is-USA~Canada-and-year-is-2000-and-tab-is-map
```

Tabs become "-is-"
Newlines become -and-"

(But the delimiters are params that you can define yourself)

## Benefits

1. A single place to encode and decode your params. Just encode/decode the whole patch. Do not decode/encode N times for every parameter nor invent a special encoding scheme for each param.
2. Cleanly encodes arrays and nested structures.
3. Improved human readability for short params; greatly improved readability for complex params.
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

## Context

QueryString is a domain specific language for describing this structure:

```
type UrlEncodedString = Omit<string, [RestrictedCharacters]>
Map<UrlEncodedString, UrlEncodedString>
```

It has a one very restricted string type, and does not have any concept of numbers, booleans, arrays, enums, trees, nested maps, et cetera.

It is a very low level DSL; arguably adds little to no value on top of just a single string.

Patch is a DSL let's us use any data structure we want and handles the compiling/decompiling to QueryString, while preserving human readability.

JSON would be a similar alternative to Patch, except you completely lose human readability in query strings, and it suffers from JSONs lack of certain data structures.
