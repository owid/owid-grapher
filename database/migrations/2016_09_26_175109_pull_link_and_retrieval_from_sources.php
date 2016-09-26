<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Source;

class PullLinkAndRetrievalFromSources extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            Schema::table('sources', function ($table) {
                $table->string('retrieved')->nullable(false);
                $table->string('link')->nullable(false)->change();
            });

            foreach (Source::all() as $source) {  
                if (!$source->description) continue;

                $doc = new DOMDocument();
                libxml_use_internal_errors(true);
                $doc->recover = true;
                $doc->loadHTML(mb_convert_encoding($source->description, 'HTML-ENTITIES', 'UTF-8'));

                $trs = iterator_to_array($doc->getElementsByTagName("tr"));
                foreach ($trs as $tr) {
                    $lastText = null;
                    $isTaking = false;

                    foreach ($tr->getElementsByTagName("td") as $td) {
                        if (preg_match('/Retriev/i', $lastText)) {
                            $isTaking = true;
                            $source->retrieved = $td->textContent;
                        } else if (preg_match('/Link/i', $lastText)) {
                            $isTaking = true;
                            $source->link = $td->textContent;
                        }
                        $lastText = $td->textContent;                    
                    }

                    if ($isTaking) {
                        $tr->parentNode->removeChild($tr);        
                    }
                }

                $source->description = $doc->saveHTML();
                $source->save();
            }
        });
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
