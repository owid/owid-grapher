<?php namespace App\Http\Controllers;
	use URL;
	use Input;
	use Validator;
	use Redirect;
	//use ARequest;
	//use Session;
	//use App\Setting;

	use Illuminate\Http\Request;

	use App\Logo;
	use Cache;

	class LogosController extends Controller {
		
		public function index()
		{
			$logos = Logo::all();
			return view( 'logos.index', compact('logos') );
		}

		/**
		 * Show the form for creating a new resource.
		 *
		 * @return Response
		 */
		public function create()
		{
			return view( 'logos.create' );
		}

		/**
		 * Store a newly created resource in storage.
		 *
		 * @return Response
		 */
		public function store(Request $request)
		{
			// getting all of the post data
			$file = array('image' => Input::file('image'));
			// setting up rules
			$rules = array('image' => 'required',); //mimes:jpeg,bmp,png and for max size max:10000
			// doing the validation, passing post data, rules and the messages
			$validator = Validator::make($file, $rules);

			Cache::flush();
			
			if ($validator->fails()) {
			
				// send back to the page with the input data and errors
				return Redirect::to('logos/create')->withInput()->withErrors($validator);
			
			} else {
				
				// checking file is valid.
				$url = $this->uploadFile( Input::file( 'image' ) );
				if( $url ) {

					$input = array_except( $request->all(), [ '_method', '_token', 'image' ] );
					$input['url'] = $url;

					Logo::create($input);
					return redirect()->route( 'logos.index' )->with( 'message', 'Logo created.')->with( 'message-class', 'success' );
		
				} else {

					Session::flash('error', 'Uploaded file is not valid');
					return redirect()->route( 'logo' )->with( 'message', 'Uploaded file is not valid.')->with( 'message-class', 'error' );
				
				}
 				
			}

		}

		/**
		 * Display the specified resource.
		 *
		 * @param  int  $id
		 * @return Response
		 */
		public function show(Logo $logo)
		{
			return view( 'logos.show', compact( 'logo' ) );
		}

		/**
		 * Show the form for editing the specified resource.
		 *
		 * @param  int  $id
		 * @return Response
		 */
		public function edit(Logo $logo)
		{
			return view( 'logos.edit', compact( 'logo' ) );
		}

		/**
		 * Update the specified resource in storage.
		 *
		 * @param  int  $id
		 * @return Response
		 */
		public function update(Logo $logo, Request $request)
		{
			// getting all of the post data
			$file = array('image' => Input::file('image'));
			// setting up rules
			$rules = array(); //mimes:jpeg,bmp,png and for max size max:10000
			// doing the validation, passing post data, rules and the messages
			$validator = Validator::make($file, $rules);

			Cache::flush();
			
			$input = array_except( $request->all(), [ '_method', '_token', 'image' ] );

			if ($validator->fails()) {
				
				//send back to the page with the input data and errors
				return redirect()->route( 'logos.edit', $request->id )->withInput()->withErrors($validator);
			
			} else {
				
				//checking file is valid.
				$image = Input::file( 'image' );

				if( !empty( $image ) ) {
					
					//updating new image
					$url = $this->uploadFile( Input::file( 'image' ) );
					
					if( $url ) {
						$input['url'] = $url;
					} else {
						Session::flash('error', 'Uploaded file is not valid');
						return redirect()->route( 'logos.index' )->with( 'message', 'Uploaded file is not valid.')->with( 'message-class', 'error' );
					}

				}	
				
 				$logo->update($input);
				return redirect()->route( 'logos.index' )->with( 'message', 'Logo udpated.')->with( 'message-class', 'success' );

			}

			Cache::flush();
			
			return redirect()->route('sources.show', $source->id)->with( 'message', 'Source updated.')->with( 'message-class', 'success' );
		}

		/**
		 * Remove the specified resource from storage.
		 *
		 * @param  int  $id
		 * @return Response
		 */
		public function destroy(Logo $logo, Request $request)
		{	
			//delete database record
			$logo->delete();
			//delete actual file
			\File::delete($logo->url);

			Cache::flush();
			
			return redirect()->route('logos.index')->with('message', 'Logo deleted.');
		}

		private function uploadFile( $imageFile ) {

			if( $imageFile->isValid() ) {
				$destinationPath = 'uploads'; // upload path
				$extension = $imageFile->getClientOriginalExtension(); // getting image extension
				$fileName = rand( 11111, 99999 ).'.'.$extension; // renameing image
				$imageFile->move( $destinationPath, $fileName ); // uploading file to given path// sending back with message
				//construct fileUrl
				$fileUrl = $destinationPath .'/'. $fileName;
				return $fileUrl;
			}

			return false;
		
		}

}