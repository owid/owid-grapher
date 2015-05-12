<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateVariableDatasetsTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('variables_datasets', function(Blueprint $table)
		{	
			//fks
			$table->integer('fk_variable_id')->unsigned();
			$table->foreign('fk_variable_id')->references('id')->on('variables');
			$table->integer('fk_dataset_id')->unsigned();
			$table->foreign('fk_dataset_id')->references('id')->on('datasets');
			//add composite key
			$table->primary(array('fk_variable_id', 'fk_dataset_id'));
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
		Schema::drop('variables_datasets');
	}

}
