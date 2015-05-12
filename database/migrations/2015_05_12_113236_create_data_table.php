<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateDataTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('data', function(Blueprint $table)
		{
			$table->increments('id');
			
			//fks
			$table->integer('fk_time_id')->unsigned();
			$table->foreign('fk_time_id')->references('id')->on('times');
			
			$table->integer('fk_ent_id')->unsigned();
			$table->foreign('fk_ent_id')->references('id')->on('entities');
			
			$table->integer('fk_var_id')->unsigned();
			$table->foreign('fk_var_id')->references('id')->on('variables');
			
			//data
			$table->string('value');
			$table->string('description');
			$table->timestamps();
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::drop('data');
	}

}
