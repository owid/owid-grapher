;( function() {

	"use strict";

	var that;

	App.Views.UI.SettingsVarPopup = function() {

		that = this;
		this.$div = null;

	};

	App.Views.UI.SettingsVarPopup.prototype = {

		init: function( options ) {

			this.dispatcher = options.dispatcher;

			//will be filled when opening popup
			this.variableId = -1;

			this.$el = $( ".settings-var-popup" );
			this.$closeBtn = this.$el.find( ".close" );
			this.$saveBtn = this.$el.find( ".btn-primary" );
			this.$cancelBtn = this.$el.find( ".btn-default" );

			this.$periodInputs = this.$el.find( "[name=period]" );
			this.$singleInputs = this.$el.find( "[name=single]" );
			this.$allInputs = this.$el.find( "[name=all]" );
			this.$contentAll = this.$el.find( ".settings-var-content-all" );
			this.$contentSingle = this.$el.find( ".settings-var-content-single" );
				
			this.$contentSingleSpecific = this.$el.find( ".settings-var-single-specific-content" );
			this.$contentSingleLatest = this.$el.find( ".settings-var-single-latest-content" );

			this.$contentAllClosest = this.$el.find( ".settings-var-all-closest-content" );
			this.$contentAllLatest = this.$el.find( ".settings-var-all-latest-content" );

			this.$closeBtn.on( "click", $.proxy( this.onCloseBtn, this ) );
			this.$saveBtn.on( "click", $.proxy( this.onSaveBtn, this ) );
			this.$cancelBtn.on( "click", $.proxy( this.onCancelBtn, this ) );
		
			this.$periodInputs.on( "change", $.proxy( this.onPeriodInputs, this ) );
			this.$singleInputs.on( "change", $.proxy( this.onSingleInputs, this ) );
			this.$allInputs.on( "change", $.proxy( this.onAllInputs, this ) );

		},

		onPeriodInputs: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "all" ) {
				this.$contentAll.show();
				this.$contentSingle.hide();
			} else if( $input.val() === "single" ) {
				this.$contentAll.hide();
				this.$contentSingle.show();
			}

		},

		onSingleInputs: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "specific" ) {
				this.$contentSingleSpecific.show();
				this.$contentSingleLatest.hide();
			} else if( $input.val() === "latest" ) {
				this.$contentSingleSpecific.hide();
				this.$contentSingleLatest.show();
			}

		},

		onAllInputs: function( evt ) {

			var $input = $( evt.currentTarget );
			if( $input.val() === "closest" ) {
				this.$contentAllClosest.show();
				this.$contentAllLatest.hide();
			} else if( $input.val() === "latest" ) {
				this.$contentAllClosest.hide();
				this.$contentAllLatest.show();
			}

		},

		show: function( $variableLabel ) {

			this.variableId = $variableLabel.attr( "data-variable-id" );
			
			//repopulate from element
			var period = $variableLabel.attr( "data-period" ),
				mode = $variableLabel.attr( "data-mode" ),
				targetYear = $variableLabel.attr( "data-target-year" ),
				tolerance = $variableLabel.attr( "data-tolerance" ),
				maximumAge = $variableLabel.attr( "data-maximum-age" );

			if( period ) {
				
				if( period === "single" ) {

					this.$periodInputs.filter( "[value=single]" ).prop( "checked", true );

					this.$contentAll.hide();
					this.$contentSingle.show();

					if( mode === "specific" ) {

						this.$singleInputs.filter( "[value=specific]" ).prop( "checked", true );
						this.$contentSingleSpecific.show();
						this.$contentSingleLatest.hide();
						this.$el.find( "[name=single-year]" ).val( targetYear );
						this.$el.find( "[name=single-tolerance]" ).val( tolerance );

					} else if( mode === "latest" ) {

						this.$singleInputs.filter( "[value=latest]" ).prop( "checked", true );
						this.$contentSingleSpecific.hide();
						this.$contentSingleLatest.show();
						this.$el.find( "[name=single-maximum-age]" ).val( maximumAge );

					}

				} else if( period === "all" ) {
					
					this.$periodInputs.filter( "[value=all]" ).prop( "checked", true );

					this.$contentAll.show();
					this.$contentSingle.hide();

					if( mode === "closest" ) {
						
						this.$allInputs.filter( "[value=closest]" ).prop( "checked", true );
						this.$contentAllClosest.show();
						this.$contentAllLatest.hide();
						this.$el.find( "[name=all-tolerance]" ).val( tolerance );
					
					} else if( mode === "latest" ) {
						
						this.$allInputs.filter( "[value=latest]" ).prop( "checked", true );
						this.$contentAllClosest.hide();
						this.$contentAllLatest.show();
						this.$el.find( "[name=all-maximum-age]" ).val( maximumAge );
						
					}

				}

			}

			this.$el.show();

		},

		hide: function() {

			this.$el.hide();

		},

		onCloseBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		},

		onSaveBtn: function( evt ) {

			evt.preventDefault();
			
			// structure
			// - period
			//		- single 
			//			- specific
			//				- year
			//				- tolerance
			//			- latest
			//				- maximum age				
			//		- all
			//			- closest
			//				- tolerance
			//			- latest
			//				- maximum age  

			//  attributes
			//	- data-period [single|all] 
			//	- data-mode [specific|latest|closest] 
			//	- data-target-year [number] 
			//	- data-tolerance [number] 
			//	- data-maximum-age [number] 

			var data = { variableId: this.variableId };
			data.period = this.$periodInputs.filter( ":checked" ).val();

			if( data.period === "single" ) {

				data.mode = this.$singleInputs.filter( ":checked" ).val();

				if( data.mode === "specific" ) {
					data[ "target-year" ] = this.$el.find( "[name=single-year]" ).val();
					data.tolerance = this.$el.find( "[name=single-tolerance]" ).val();
				} else if( data.mode === "latest" ) {
					data[ "maximum-age" ] = this.$el.find( "[name=single-maximum-age]" ).val();
				}


			} else if( data.period === "all" ) {

				data.mode = this.$allInputs.filter( ":checked" ).val();

				if( data.mode === "closest" ) {
					data.tolerance = this.$el.find( "[name=all-tolerance]" ).val();
				} else if( data.mode === "latest" ) {
					data[ "maximum-age" ] = this.$el.find( "[name=all-maximum-age]" ).val();
				}

			}

			console.log( "data", data );

			this.dispatcher.trigger( "dimension-setting-update", data );

		},

		onCancelBtn: function( evt ) {

			evt.preventDefault();
			this.hide();

		}

	};

})();
