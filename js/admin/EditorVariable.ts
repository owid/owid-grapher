interface EditorVariable {
	name: string,
	id: number,
	unit: string,
	description: string,
	dataset: {
		name: string,
        namespace: string,
		category: string,
		subcategory: string
	}
}

export default EditorVariable