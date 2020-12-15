# Patch: a tiny DSL for query strings

Patch is a tiny library with no external dependencies that provides an **immutable** object that maps a subset of Javascript object literals to a URI encoded string.

Patch gets its power from its isomorphisms. With Patch, you design your query params so that they map to a TSV document. Then Patch encodes and decodes that document.

## Quick Example

```json
{
    "selection": "Canada",
    "year": "2000",
    "tab": "map"
}
```

Serializing this Object Literal into a URL looks like:

**Without Patch** `selection=Canada&year=2000&tab=map`

**With Patch** `patch=selection~Canada...year~2000...tab~map`

The Patch is isomorphic to this TSV:

```tsv
selection\tCanada
year\t2000
tab\tmap
```

## Specification

### The 4 Isomorphisms of Patch

A Patch object has 4 forms:

1. URI encoded string form

```
countries~Canada~France...year~2020
```

2.  TSV form (or any similarly delimited form)

```
countries\tCanada\tFrance
year\t2020
```

3.  JSON Superset Form (AKA Object Literal Form)

```
{
    "countries": ["Canada", "France"],
    "years": ["2020"],
}
```

4.  Javascript Matrix Form

```
[
    ["countries", "Canada", "France"],
    ["years", "2020", "France],
]
```

Note: if you use form #3 and have duplicate identifiers, be sure to parse yourself as JSON does not support duplicate identifiers.

**URI Encoding** String inputs to the Patch constructor are assumed to be encoded with `encodeURIComponent` and will be decoded before parsing. Similarly the string output is always encoded.

**Delimiters** Patch requires 2 delimiters, one for separating "rows" and one for separating "columns". Patch is isomorphic to TSVs. Currently for the delimiters
we use "-is-" for tabs and "-and-" for newlines. You can change those to suit your own preferences or needs.

**Versioning** Just use semantic versioning, only caring about breaking changes so only a major version: `patchVersion=2&patch=...`

**No Escape Characters** Patch does not have an escape character mechanism. You may need to change the Delimiters to support rare use cases.

**Spaces** Patch encodes spaces to "+" instead of "%20" and uses the standard encoding of "+" to "%2B".

## When to use

Patch comes in handy when you have GridLangs that:

-   have state
-   that the user can change
-   that the user should be able to take with them and rehydrate the class with via URLs

## Context

QueryString is a domain specific language for describing this structure:

```
type UrlEncodedString = Omit<string, [RestrictedCharacters]>
Map<UrlEncodedString, UrlEncodedString>
```

It has a one very restricted string type, and does not have any concept of numbers, booleans, arrays, enums, trees, nested maps, et cetera.

It is a very low level DSL; arguably adds little to no value on top of just a single string.

Patch is a DSL let's you use any data structure you want and handles the compiling/decompiling to QueryString, while preserving human readability.

JSON would be a similar alternative to Patch, except you completely lose human readability in query strings, and it suffers from JSONs lack of certain data structures, like tuple arrays.

Some benefits of Patch:

1. A single place to encode and decode your params. Just encode/decode the whole patch. Do not decode/encode N times for every parameter nor invent a special encoding scheme for each param.
2. Cleanly encodes arrays and nested structures.
3. Improved human readability for short params; greatly improved readability for complex params.
4. Versioning with easy upgrading.
5. Very easy to debug—it's just a patch!
