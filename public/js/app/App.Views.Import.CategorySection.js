;(function() {	
	"use strict";
	owid.namespace("App.Views.Import.CategorySection");

	App.Views.Import.CategorySection = owid.View.extend({
		el: ".category-section",

		events: {
			"change [name=category_id]": "onCategoryChange",
			"change [name=subcategory_id]": "onSubcategoryChange",
		},

		initialize: function() {
			this.$categorySelect = this.$("[name=category_id]");
			this.$subcategorySelect = this.$("[name=subcategory_id]");

			this.listenTo(App.DatasetModel, "change:categoryId change:subcategoryId", this.render.bind(this));
			this.render();
		},

		onCategoryChange: function() {
			App.DatasetModel.set("categoryId", this.$categorySelect.val());
		},

		onSubcategoryChange: function() {
			App.DatasetModel.set("subcategoryId", this.$subcategorySelect.val());
		},

		validate: function() {
			var $categoryValidationNotice = $(".category-validation-result");
			if( !this.$categorySelect.val() || !this.$subcategorySelect.val() ) {
				if (!$categoryValidationNotice.length) {
					$categoryValidationNotice = $( "<p class='category-validation-result validation-result text-danger'><i class='fa fa-exclamation-circle'>Please choose a category and subcategory for uploaded data.</p>" );
					this.$categorySelect.before( $categoryValidationNotice );
				} {
					$categoryValidationNotice.show();
				}
			} else {
				//valid, make sure to remove
				$categoryValidationNotice.remove();
			}
		},

		render: function() {
			var categoryId = App.DatasetModel.get("categoryId"),
				subcategoryId = App.DatasetModel.get("subcategoryId");
			this.$categorySelect.val(categoryId);

			this.$subcategorySelect.find("option").hide();
			this.$subcategorySelect.find("option[data-category-id=" + categoryId + "]").show();
			this.$subcategorySelect.val(subcategoryId);
			if (this.$subcategorySelect.find("option:selected").attr("data-category-id") != categoryId)
				this.$subcategorySelect.val("");
		},
	});
})();