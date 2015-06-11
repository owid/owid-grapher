<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateVariableTypesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('variable_types', function(Blueprint $table)
		{
			$table->increments('id');
			$table->string('name');
			$table->boolean('isSortable');
		});
		Schema::table('variables', function(Blueprint $table)
		{
			$table->integer('fk_var_type_id')->unsigned();
			$table->foreign('fk_var_type_id')->references('id')->on('variable_types');
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::table('variables', function(Blueprint $table)
		{
			$table->dropForeign('variables_fk_var_type_id_foreign');
			$table->dropColumn('fk_var_type_id');
		});
		Schema::drop('variable_types');
	}

}
