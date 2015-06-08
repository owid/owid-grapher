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
			$table->text('iso2');
			$table->text('iso3');
			$table->text('cow3');
			$table->text('name');
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
