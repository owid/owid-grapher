/**
 * A TC39 decorator that marks auto-accessor fields as enumerable.
 * This decorator can be applied to auto-accessor fields to ensure they
 * appear in Object.keys() and object spread operations.
 */
export function enumerable(value: any, context: ClassAccessorDecoratorContext) {
    // Ensure this decorator is only used on accessor fields
    if (context.kind !== "accessor") {
        throw new Error("@enumerable can only be applied to accessor fields")
    }

    const propertyName = context.name

    // Use addInitializer to modify the property after class construction
    context.addInitializer(function (this: any) {
        // Store the initial value
        const initialValue = this[propertyName]

        // Find the accessor descriptor (might be on prototype)
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let target = this
        let descriptor: PropertyDescriptor | undefined

        while (target && !descriptor) {
            descriptor = Object.getOwnPropertyDescriptor(target, propertyName)
            if (!descriptor) {
                target = Object.getPrototypeOf(target)
            }
        }

        if (descriptor && (descriptor.get || descriptor.set)) {
            // Create an enumerable property on the instance with the same getter/setter behavior
            Object.defineProperty(this, propertyName, {
                get: descriptor.get,
                set: descriptor.set,
                enumerable: true,
                configurable: true,
            })

            // Restore the initial value if it was different
            if (
                initialValue !== undefined &&
                this[propertyName] !== initialValue
            ) {
                this[propertyName] = initialValue
            }
        }
    })

    // Return the original value unchanged
    return value
}
