<?php

use App\User;
use Illuminate\Database\Seeder;
 
class UsersTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('users')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE users AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$user = User::create( array(
			'name' => 'test',
			'email' => 'test@email.com',
			'password' => Hash::make('a')
		) );

		
	}

}

?>

