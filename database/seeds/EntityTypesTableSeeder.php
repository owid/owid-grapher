<?php
 
use Illuminate\Database\Seeder;
 
class EntityTypesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('entity_types')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE entity_types AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$entity_types = array(
			[ 'name' => 'Abstract', 'has_geometry' => 0 ],
			[ 'name' => 'World', 'has_geometry' => 1 ],
			[ 'name' => 'Continent', 'has_geometry' => 1 ],
			[ 'name' => 'Region', 'has_geometry' => 1 ],
			[ 'name' => 'Country', 'has_geometry' => 1 ],
			[ 'name' => 'State', 'has_geometry' => 1 ],
			[ 'name' => 'District', 'has_geometry' => 1 ],
			[ 'name' => 'City', 'has_geometry' => 1 ],
			[ 'name' => 'Neighbourhood', 'has_geometry' => 1 ],
			[ 'name' => 'Street', 'has_geometry' => 1 ],
			[ 'name' => 'Place', 'has_geometry' => 1 ],
			[ 'name' => 'Organisation', 'has_geometry' => 0 ],
			[ 'name' => 'Person', 'has_geometry' => 0 ],
		);
		
		// Uncomment the below to run the seeder
		DB::table('entity_types')->insert($entity_types);
	}

}

?>