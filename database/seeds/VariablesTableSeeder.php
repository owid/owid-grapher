<?php
 
use Illuminate\Database\Seeder;
 
class VariablesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('variables')->delete();

		//reset autoincrement
		$statement = "ALTER TABLE variables AUTO_INCREMENT = 1;";
		DB::unprepared($statement);

		$variables = array();
		$len = 3;
		for( $i = 0; $i < $len; $i++ ) {
			$fk_dst_id = (rand(0,1)>.5)? 1: 2;
			$variables[] = [ 'fk_dst_id' => $fk_dst_id, 'name' => 'Variable ' .$i, 'unit' => '$', 'description' => 'Description ' .$i, 'fk_var_type_id' => 2 ];
		}
		// Uncomment the below to run the seeder
		DB::table('variables')->insert($variables);
	}

}
