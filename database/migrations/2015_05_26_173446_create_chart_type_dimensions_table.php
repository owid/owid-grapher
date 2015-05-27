<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateChartTypeDimensionsTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('chart_type_dimensions', function(Blueprint $table)
		{
			$table->increments('id');
			$table->string('property');
			$table->string('name');
			$table->string('type');

			$table->integer('fk_chart_type_id')->unsigned();
			$table->foreign('fk_chart_type_id')->references('id')->on('chart_types');
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::drop('chart_type_dimensions');
	}

}
