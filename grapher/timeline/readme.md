# Timeline

The current organization of the timeline is as follows:

1. `TimelineManager`: This is just an interface, in our case implemented by Grapher. The actual thing to be played should implement this. An alternative name might be `ThingWithTimeline`.
2. `TimelineController`: This is the headless class that handles the timeline logic. It takes a TimelineManager as a param and will control that.
3. `TimelineComponent`: This takes in a TimelineController and renders the actual timeline controls.
