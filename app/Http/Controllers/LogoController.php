<?php namespace App\Http\Controllers;
	use URL;
	use Input;
	use Validator;
	use Redirect;
	use Request;
	use Session;
	use App\Setting;

	class LogoController extends Controller {
		
		public function index() {
			$logoUrl = Setting::where( 'meta_name', 'logoUrl' )->first();
			return view( 'logo.index', compact('logoUrl') );
		}

		public function upload() {
			// getting all of the post data
			$file = array('image' => Input::file('image'));
			// setting up rules
			$rules = array('image' => 'required',); //mimes:jpeg,bmp,png and for max size max:10000
			// doing the validation, passing post data, rules and the messages
			$validator = Validator::make($file, $rules);
			if ($validator->fails()) {
				// send back to the page with the input data and errors
				return Redirect::to('logo')->withInput()->withErrors($validator);
			} else {
				// checking file is valid.
				if( Input::file('image')->isValid() ) {
					$destinationPath = 'uploads'; // upload path
					$extension = Input::file( 'image' )->getClientOriginalExtension(); // getting image extension
					$fileName = rand( 11111, 99999 ).'.'.$extension; // renameing image
					Input::file('image')->move( $destinationPath, $fileName ); // uploading file to given path// sending back with message

					//store into db
					$logoUrl = Setting::where( 'meta_name', 'logo_url' )->first();
					if( empty( $logoUrl ) ) {
						$logoUrl = new Setting;
					}

					$logoUrl->meta_name = 'logoUrl';
					$logoUrl->meta_value = $destinationPath .'/'. $fileName;
					$logoUrl->save();	
					
					return redirect()->route( 'logo' )->with( 'message', 'Logo updated.')->with( 'message-class', 'success' );
	
				} else {
					// sending back with error message.
					Session::flash('error', 'uploaded file is not valid');
					return redirect()->route( 'logo' )->with( 'message', 'Uploaded file is not valid.')->with( 'message-class', 'error' );
				}
			}
		}
	}