<?php
 
use Illuminate\Database\Seeder;
 
class TimeTypesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('time_types')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE time_types AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$time_types = array(
			[ 'name' => 'Year' ],
			[ 'name' => 'Decade' ],
			[ 'name' => 'Quarter Century' ],
			[ 'name' => 'Half Century' ],
			[ 'name' => 'Century' ],
		);
		
		// Uncomment the below to run the seeder
		DB::table('time_types')->insert($time_types);
	}

}

?>