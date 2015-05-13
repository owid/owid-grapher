<?php
 
use Illuminate\Database\Seeder;
 
class VariableTypesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('variable_types')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE variable_types AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$variable_types = array(
			[ 'name' => 'Nominal', 'isSortable' => 0 ],
			[ 'name' => 'Ordinal', 'isSortable' => 1 ],
			[ 'name' => 'Interval', 'isSortable' => 1 ],
			[ 'name' => 'Ratio', 'isSortable' => 1 ],
		);
		
		// Uncomment the below to run the seeder
		DB::table('variable_types')->insert($variable_types);
	}

}

?>