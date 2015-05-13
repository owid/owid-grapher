<?php
 
use Illuminate\Database\Seeder;
 
class InputFilesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('input_files')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE input_files AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$input_files = array(
			[ 'fk_user_id' => 1 ],
		);
		
		// Uncomment the below to run the seeder
		DB::table('input_files')->insert($input_files);
	}

}

?>