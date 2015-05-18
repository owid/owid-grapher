<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateDatasetSubcategoriesTable extends Migration {

	/**
	 * Run the migrations.
	 *
	 * @return void
	 */
	public function up()
	{
		Schema::create('dataset_subcategories', function(Blueprint $table)
		{
			$table->increments('id');
			$table->string('name');
			$table->integer('fk_dst_cat_id')->unsigned()->nullable();
			$table->foreign('fk_dst_cat_id')->references('id')->on('dataset_categories');
			$table->timestamps();
		});
		Schema::table('datasets', function($table) 
		{
			$table->integer('fk_dst_subcat_id')->unsigned()->nullable();
			$table->foreign('fk_dst_subcat_id')->references('id')->on('dataset_subcategories');
		});
	}

	/**
	 * Reverse the migrations.
	 *
	 * @return void
	 */
	public function down()
	{
		Schema::table('datasets', function($table) 
		{
			$table->dropForeign('datasets_fk_dst_subcat_id_foreign');
			$table->dropColumn('fk_dst_subcat_id');
		});
		Schema::drop('dataset_subcategories');
	}

}
