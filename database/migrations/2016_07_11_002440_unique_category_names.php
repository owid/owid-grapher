<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class UniqueCategoryNames extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            DB::statement("DELETE FROM dataset_subcategories WHERE id=53");
            DB::statement('CREATE UNIQUE INDEX dataset_subcategories_name_unique ON dataset_subcategories (name, fk_dst_cat_id)');
            DB::statement('CREATE UNIQUE INDEX dataset_categories_name_unique ON dataset_categories (name)');
        });
    }
}
