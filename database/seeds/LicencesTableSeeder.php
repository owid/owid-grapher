<?php
 
use Illuminate\Database\Seeder;
 
class LicencesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('licenses')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE licenses AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$licences = array(
			[ 'name' => 'Creative Commons',
			 'description' => 'The author Max Roser licensed this visualisation under a <a class="licence-link" href="http://creativecommons.org/licenses/by-sa/4.0/deed.en_US" target="_blank">CC BY-SA license</a>. You are welcome to share but please refer to its source where you can find more information: <a class="source-link" href="http://www.ourworldindata.org" target="_blank">OurWorldInData.org</a>' ]
		);
		
		// Uncomment the below to run the seeder
		DB::table('licenses')->insert($licences);
	}

}

?>