<?php
 
use Illuminate\Database\Seeder;
 
class DatasourcesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('datasources')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE datasources AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$values = array();
		$len = 5;
		for( $i = 0; $i <= $len; $i++ ) {
			$values[] = [ 'name' => 'Datasource ' .$i, 'link' => 'http://www.dsr' .$i, 'description' => 'Description ' .$i  ];
		}
		
		// Uncomment the below to run the seeder
		DB::table('datasources')->insert($values);
	}

}

?>