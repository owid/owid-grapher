<?php
 
use Illuminate\Database\Seeder;
 
class TimesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('times')->delete();

		//reset autoincrement
		$statement = "ALTER TABLE times AUTO_INCREMENT = 1;";
		DB::unprepared($statement);

		$times = array();
		$roundLen = 15;
		for( $y = 0; $y < $roundLen; $y++ ) {
			$len = 100;
			for( $i = 0; $i < $len; $i++ ) {
				$times[] = [ 'label' => $i+1000, 'date' => $i+1000 ];
			}
		}

		
		// Uncomment the below to run the seeder
		DB::table('times')->insert($times);
	}

}
