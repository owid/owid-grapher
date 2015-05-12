<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateVariablesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('variables', function(Blueprint $table)
		{
			$table->increments('id');
			//data
			$table->string('name');
			$table->string('unit');
			$table->string('description');
			//fks
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
		Schema::drop('variables');
	}

}
