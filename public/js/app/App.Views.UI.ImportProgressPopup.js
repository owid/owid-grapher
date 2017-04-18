;(function() {
	"use strict";
	owid.namespace("App.Views.UI.ImportProgressPopup");
	
	var that;

	App.Views.UI.ImportProgressPopup = function() {

		that = this;
		this.datasetId = -1;
		this.$div = null;

	};

	App.Views.UI.ImportProgressPopup.prototype = {

		init: function( options ) {

			this.dispatcher = options.dispatcher;

			this.$el = $( ".import-progress-popup" );
			this.$title = this.$el.find( ".modal-title" );
			this.$progress = this.$title.find( ".progress" );
			this.$body = this.$el.find( ".modal-body" );
			this.$bodyInner = this.$el.find( ".modal-body-inner" );
			this.$footer = this.$el.find( ".modal-footer" );

			this.$closeBtn = this.$el.find( ".btn-close" );
			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			
			this.dispatcher.on( "import-progress", this.onImportProgress, this );

		},

		onImportProgress: function( msg, success, progress, finish, datasetId ) {
			
			var className = ( success )? "success": "error",
				icon = ( success )? "<i class='fa fa-check'></i>": "<i class='fa fa-times'></i>";
			this.$bodyInner.append( "<p class='" + className + "'>" + icon + msg + "</p>" );

			//update progress
			if( progress ) {
				this.$progress.text( progress );
			}

			//animate
			this.$body.animate( {scrollTop: this.$bodyInner.height()}, 'fast');
			
			if( finish ) {
				this.datasetId = datasetId;
				//window.location = Global.rootUrl + "/datasets/" + this.datasetId;
				this.$body.append( "<p class='success'><i class='fa fa-check'></i>Import finished!</p>" );
				this.$footer.show();
				this.$title.addClass( "success" );
				this.$title.find( ".fa" ).removeClass( "fa-spin" ).removeClass( "fa-spinner" ).addClass( "fa-check" );
			}

			if( !success ) {
				//problem while importing, enable closing popup
				this.$footer.show();
				this.$title.addClass( "error" );
				this.$title.find( ".fa" ).removeClass( "fa-spin" ).removeClass( "fa-spinner" ).addClass( "fa-times" );
			}

		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		onCloseBtn: function( evt ) {
			evt.preventDefault();
			this.hide();

			var $btn = $( evt.currentTarget ),
				redirectUrl = $btn.attr( "data-redirect-url" );
			window.location = redirectUrl + "/" + this.datasetId;
		}
	};
})();
