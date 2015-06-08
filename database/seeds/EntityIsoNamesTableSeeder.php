<?php
 
use Illuminate\Database\Seeder;
 
class EntityIsoNamesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('entity_iso_names')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE entity_iso_names AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		//load file with data
		$filename = "/_projects/oxford/_pieces/data/iso.csv";
		$csv = \League\Csv\Reader::createFromPath($filename); 
		DB::table('entity_iso_names')->insert( $csv->fetchAssoc() );

	}

}

?>