<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateInputFilesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('input_files', function(Blueprint $table)
		{
			$table->increments('id');
			$table->text('raw_data');
			//fk
			$table->integer('fk_user_id')->unsigned();
			$table->foreign('fk_user_id')->references('id')->on('users');
			//time
			$table->timestamps();
		});
		Schema::table('data_values', function(Blueprint $table)
		{
			$table->integer('fk_input_files_id')->unsigned();
			$table->foreign('fk_input_files_id')->references('id')->on('input_files');
		});
			
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::table('data_values', function(Blueprint $table)
		{
			$table->dropForeign('data_values_fk_input_files_id_foreign');
			$table->dropColumn('fk_input_files_id');
		});
		Schema::drop('input_files');
	}

}
