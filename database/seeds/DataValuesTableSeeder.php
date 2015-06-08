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

		$ent_len = 5;
		$timeId = 1;
		for( $z = 1; $z <= $ent_len; $z++ ) {
			$cat_len = 3;
			for( $i = 1; $i <= $cat_len; $i++ ) {
				$var_len = 100;
				for( $y = 1; $y <= $var_len; $y++ ) {
					$values[] = [ 'value' => (rand(0,1)>.1)?rand(0,10)*$y:0, 'description' => 'Description for var' .$y, 'fk_var_id' => $i, 'fk_input_files_id' => 1, 'fk_ent_id' => $z, 'fk_time_id' => $timeId, 'fk_dsr_id' => 1 ];
					$timeId++;
				}
			}	
		}
		
		// Uncomment the below to run the seeder
		DB::table('data_values')->insert($values);
	}

}

?>