<?php
 
use Illuminate\Database\Seeder;
 
class DataValuesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('data_values')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE data_values AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$values = array();

		$cat_len = 3;
		for( $i = 1; $i <= $cat_len; $i++ ) {
			$var_len = 1000;
			for( $y = 0; $y < $var_len; $y++ ) {
				$values[] = [ 'value' => $y, 'description' => 'Description for var' .$y, 'fk_var_id' => $i, 'fk_input_files_id' => 1, 'fk_ent_id' => rand(1,5) ];
			}
		}
		
		// Uncomment the below to run the seeder
		DB::table('data_values')->insert($values);
	}

}

?>