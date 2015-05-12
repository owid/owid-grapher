<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateEntityMetasTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('entity_metas', function(Blueprint $table)
		{
			$table->increments('id');
			//data
			$table->string('meta_name');
			$table->string('meta_value');
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
		Schema::drop('entity_metas');
	}

}
