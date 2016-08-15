<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Source;

class CleanSources extends Migration
{
    public function up() {
        DB::transaction(function() {
            foreach (Source::all() as $source) {
                $newSources = [];

                foreach ($source->variables as $variable) {
                    if ($variable->fk_dst_id != $source->datasetId) {
                        if (isset($newSources[$variable->fk_dst_id])) {
                            $newSource = $newSources[$variable->fk_dst_id];
                        } else {                        
                            $newSource = $source->replicate();
                            $newSource->datasetId = $variable->fk_dst_id;
                            $newSource->save();
                        }
                        $variable->sourceId = $newSource->id;
                        $variable->save();
                        $newSources[$variable->fk_dst_id] = $newSource;
                    }
                }
            }            
        });
    }
}
