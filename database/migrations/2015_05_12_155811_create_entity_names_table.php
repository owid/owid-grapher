<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateEntityNamesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('entity_names', function(Blueprint $table)
		{
			$table->increments('id');
			//fks
			$table->integer('fk_entity_id')->unsigned();
			$table->foreign('fk_entity_id')->references('id')->on('entities');
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
		Schema::drop('entity_names');
	}

}
