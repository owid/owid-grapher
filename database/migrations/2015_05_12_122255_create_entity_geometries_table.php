<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateEntityGeometriesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('entity_geometries', function(Blueprint $table)
		{
			$table->increments('id');
			//data
			$table->longText('geom');
			//fks
			$table->integer('fk_times_id')->unsigned();
			$table->foreign('fk_times_id')->references('id')->on('times');
			$table->integer('fk_ent_id')->unsigned();
			$table->foreign('fk_ent_id')->references('id')->on('entities');
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
		Schema::drop('entity_geometries');
	}

}
