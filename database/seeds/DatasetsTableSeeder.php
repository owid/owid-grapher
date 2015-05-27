<?php
 
use Illuminate\Database\Seeder;
 
class DatasetsTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('datasets')->delete();

		//reset autoincrement
		$statement = "ALTER TABLE datasets AUTO_INCREMENT = 1;";
		DB::unprepared($statement);

		$datasets = array(
			[ 'name' => 'test dataset', 'fk_dst_cat_id' => 1, 'fk_dst_subcat_id' => 1]
		);
		
		// Uncomment the below to run the seeder
		DB::table('datasets')->insert($datasets);
	}

}
