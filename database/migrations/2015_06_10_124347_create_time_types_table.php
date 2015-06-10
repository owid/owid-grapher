<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateTimeTypesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('time_types', function(Blueprint $table)
		{
			$table->increments('id');
			$table->string('name');
			//$table->timestamps();
		});
		Schema::table('times', function($table) 
		{
			$table->integer('fk_ttype_id')->unsigned()->nullable();
			$table->foreign('fk_ttype_id')->references('id')->on('time_types');
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::table('times', function($table) 
		{
			$table->dropForeign('times_fk_ttype_id_foreign');
			$table->dropColumn('fk_ttype_id');
		});
		Schema::drop('time_types');
	}

}
