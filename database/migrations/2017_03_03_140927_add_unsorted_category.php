<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\DatasetCategory;
use App\DatasetSubcategory;

class AddUnsortedCategory extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()

    {
        $category = DatasetCategory::create(['name' => 'Uncategorized']);
        $subcategory = DatasetSubcategory::create(['name' => 'Uncategorized', 'fk_dst_cat_id' => $category->id]);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        //
    }
}
