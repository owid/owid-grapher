<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class SetSourceDatasetIds extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::table("UPDATE sources JOIN variables ON variables.fk_dsr_id=sources.id SET sources.datasetId=variables.fk_dst_id");
        DB::table("DELETE FROM sources WHERE datasetId IS NULL");
    }
}
