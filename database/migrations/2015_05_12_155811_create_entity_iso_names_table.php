<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateEntityIsoNamesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('entity_iso_names', function(Blueprint $table)
		{
			$table->increments('id');
			$table->text('code');
			//$table->text('iso3');
			//$table->text('numeric-string');
			//$table->text('iso31662');
			$table->text('name');
			//$table->text('continent-code');
			//$table->text('continent-name');
			//$table->integer('numeric-num');
			//$table->integer('cow');
			//$table->text('cow-letters');
			//$table->text('world-bank-regions');

		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::drop('entity_iso_names');
	}

}
