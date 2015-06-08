<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateDataValuesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('data_values', function(Blueprint $table)
		{
			$table->increments('id');
			//data
			$table->string('value');
			$table->string('description');
			//fks
			$table->integer('fk_time_id')->unsigned()->nullable();
			$table->foreign('fk_time_id')->references('id')->on('times');
			$table->integer('fk_ent_id')->unsigned()->nullable();
			$table->foreign('fk_ent_id')->references('id')->on('entities');
			$table->integer('fk_var_id')->unsigned();
			$table->foreign('fk_var_id')->references('id')->on('variables');
			$table->integer('fk_dsr_id')->unsigned()->nullable();
			$table->foreign('fk_dsr_id')->references('id')->on('datasources');
			//time
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
		Schema::drop('data_values');
	}

}
