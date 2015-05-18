<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateLinkDatasetsTagsTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('link_datasets_tags', function(Blueprint $table)
		{
			$table->increments('id');
			$table->integer('fk_dst_id')->unsigned();
			$table->foreign('fk_dst_id')->references('id')->on('datasets');
			$table->integer('fk_dst_tags_id')->unsigned();
			$table->foreign('fk_dst_tags_id')->references('id')->on('dataset_tags');
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
		Schema::drop('link_datasets_tags');
	}

}
