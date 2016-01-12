<?php namespace App\Http\Controllers;
	use URL;
	use Input;
	use Validator;
	use Redirect;
	use Request;
	use Session;
	use App\Setting;

	class SourceTemplateController extends Controller {
		
		public function edit() {
			$sourceTemplate = Setting::where( 'meta_name', 'sourceTemplate' )->first();
			return view( 'sourceTemplate.edit', compact('sourceTemplate') );
		}

		public function update() {
	
			$validator = Validator::make( 
				[ 'source_template' => Input::get( 'source_template' ) ],
				[ 'source_template' => 'required' ]
			);

			if ($validator->fails()) {
			
				// send back to the page with the input data and errors
				return Redirect::to( 'sourceTemplate' )->withInput()->withErrors($validator);
			
			} else {

				//store into db
				$sourceTemplate = Setting::firstOrCreate( [ 'meta_name' => 'sourceTemplate' ] )->first();
				$sourceTemplate->meta_name = 'sourceTemplate';
				$sourceTemplate->meta_value = Input::input( 'source_template' );
				$sourceTemplate->save();

				return redirect()->route( 'sourceTemplate' )->with( 'message', 'Source template updated.')->with( 'message-class', 'success' );
	
			}

		}
	}