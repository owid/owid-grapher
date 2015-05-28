<?php
 
use Illuminate\Database\Seeder;
 
class ChartTypeDimensionsTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('chart_type_dimensions')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE chart_type_dimensions AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$chart_types = array(
			[ 'property' => 'y', 'name' => 'Y axis', 'type' => 'number', 'fk_chart_type_id' => 1 ],
			[ 'property' => 'x', 'name' => 'X axis', 'type' => 'number', 'fk_chart_type_id' => 2 ],
			[ 'property' => 'y', 'name' => 'Y axis', 'type' => 'number', 'fk_chart_type_id' => 2 ],
			[ 'property' => 'size', 'name' => 'Size', 'type' => 'number', 'fk_chart_type_id' => 2 ],
			[ 'property' => 'shape', 'name' => 'Shape', 'type' => 'string', 'fk_chart_type_id' => 2 ],
		);
		
		// Uncomment the below to run the seeder
		DB::table('chart_type_dimensions')->insert($chart_types);
	}

}

?>