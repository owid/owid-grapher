<?php
 
use Illuminate\Database\Seeder;
 
class SettingsTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('settings')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE settings AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$settings = array(
			[ 'meta_name' => 'logoUrl', 'meta_value' => 'uploads/77286.png' ],
		);
		
		// Uncomment the below to run the seeder
		DB::table('settings')->insert($settings);
	}

}

?>