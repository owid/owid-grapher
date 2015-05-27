<?php
 
use Illuminate\Database\Seeder;
 
class EntitiesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('entities')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE entities AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$entities = array();
		$len = 5;
		for( $i = 0; $i < $len; $i++ ) {
			$entities[] = [ 'name' => 'Entity ' .$i, 'fk_ent_t_id' => 1 ];
		}
		// Uncomment the below to run the seeder
		DB::table('entities')->insert($entities);
	}

}

?>