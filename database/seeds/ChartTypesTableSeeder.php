<?php
 
use Illuminate\Database\Seeder;
 	  
class ChartTypesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('chart_types')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE chart_types AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$chart_types = array(
			[ 'name' => 'Line Chart' ],
			[ 'name' => 'Scatter Plot' ],
			[ 'name' => 'Stacked Area Chart' ]
		);
		
		// Uncomment the below to run the seeder
		DB::table('chart_types')->insert($chart_types);
	}

}

?>