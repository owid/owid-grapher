# Persistable

This Persistable interface should be used on all classes that we want to save and rehydrate.

# Rationale

The Grapher admin let's authors create and edit instances of Grapher at runtime, and we save those to disk for later playback.

So Graphers, and a number of properties on Grapher, are persisted. Although relatively simple, because serializing and deserializing are
such a core bit of our code, and because we often make slight adjustments in both places, it helps to have a standard way of
doing that throughout the Grapher codebase. Our use of Mobx also makes our needs a little different than others.

Previously we had bugs where we would write something to the DB that should have only been a runtime property, or vice versa.

# Alternatives Considered

No reason to keep this code, if we come up with a better pattern or library. One potential one is this: https://github.com/mobxjs/serializr

But our needs are pretty small so it may make sense to just have our own tiny implementation.

# Todo

Note that the `update` method is not ideal and is not RAII. We should probably do all initialization in the constructor instead of in the updates.
