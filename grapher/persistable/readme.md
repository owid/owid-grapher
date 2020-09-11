# Persistable

This Persistable interface should be used on all classes that we want to save and rehydrate.

The pattern that has emerged (but can probably be improved upon) is:

1.  An `Interface` for all the properties to be serialized/deserialized.
2.  An `DefaultsClass` implementing `Interface` with all the properties and defaults. This is only necessary in order to identify the runtime vs persistable properties, and for comparing defaults. This should have no methods.
3.  A class extending the `DefaultsClass` and implementing interface `Persistable`. This is your main class.

1 & 2 can be combined, and you can just generate an interface from the `DefaultsClass`.

## Rationale

The Grapher admin let's authors create and edit instances of Grapher at runtime, and we save those to disk for later playback.

So Graphers, and a number of properties on Grapher, are persisted. Although relatively simple, because serializing and deserializing are
such a core bit of our code, and because we often make slight adjustments in both places, it helps to have a standard way of
doing that throughout the Grapher codebase. Our use of Mobx also makes our needs a little different than others. Previously we had bugs where we would write something
to the DB that should have only been a runtime property, or vice versa.

The specific needs we have are listed below.

Serializing:

-   should serialize only persistable properties
-   should have the option to serialize only values changed from their defaults
-   should be able to serialize/deserialize arbitrary "special values" that don't interchange well with JSON, such as Infinity
-   should be able to follow these rules recursively

Deserializing:

-   should instantiate the proper non-primitive classes
-   should be able to parse "special values" to the proper in-memory structure
-   should optionally be able to validate
-   should be able to follow these rules recursively

## How to Use

See the interface definition.

## Alternatives Considered

No reason to keep this code, if we come up with a better pattern or library. One potential one is this: https://github.com/mobxjs/serializr

But our needs are pretty small so it may make sense to just have our own tiny implementation.

## Todo

Note that the `update` method is not ideal and is not RAII. We should probably do all initialization in the constructor instead of in the updates.
