<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ValidateEstebanEntities extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            $names = ['Melanesia', 'Polynesia', 'Caribbean Netherlands', 'Northern Cyprus'];
            $codes = ['OWID_MNS', 'OWID_PYA', 'OWID_NLC', 'OWID_CYN'];
            for ($i = 0; $i < sizeof($names); $i++) {
                DB::statement("INSERT INTO entities (code, name, validated, fk_ent_t_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE code=VALUES(code), name=VALUES(name), validated=1;", [$codes[$i], $names[$i], 1, 5]);                        
            }
        });
    }
}
