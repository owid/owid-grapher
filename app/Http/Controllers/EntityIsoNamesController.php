<?php namespace App\Http\Controllers;

use Input;
use App\EntityIsoName;
use App\Http\Requests;
use App\Http\Controllers\Controller;

use Illuminate\Http\Request;

class EntityIsoNamesController extends Controller {
	public function validateData( Request $request ) {


		$entitiesString = Input::get( 'entities' );
		$entities = json_decode( $entitiesString );

		$unmatched = array();
		foreach( $entities as $entity ) {
			$match = EntityIsoName::match( $entity )->first();
			if( !$match ) {
				$unmatched[] = $entity;
			}
		}
		
		$data = $unmatched;

		if( $request->ajax() ) {

			return ['success' => true, 'data' => $data ];

		} else {
			//not ajax request, just spit out whatever is in data
			return print_r($data,true);
		}

	}

}
