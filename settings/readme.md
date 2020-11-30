# Settings

In general, we should move away from this pattern of mutable globals. Instead, pass in settings your functions need at the top level and pass them down, functional style.
