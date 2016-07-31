<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Source;

class PullCoverageFromSources extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            foreach (Source::all() as $source) {  
                if (!$source->description) continue;

                $variables = $source->variables()->get();
                $doc = new DOMDocument();
                libxml_use_internal_errors(true);
                $doc->recover = true;
                $doc->loadHTML(mb_convert_encoding($source->description, 'HTML-ENTITIES', 'UTF-8'));

                $trs = iterator_to_array($doc->getElementsByTagName("tr"));
                foreach ($trs as $tr) {
                    $lastText = null;
                    $isTaking = false;

                    foreach ($tr->getElementsByTagName("td") as $td) {
                        //var_dump($lastText);
                        if (preg_match('/time span/i', $lastText)) {
                            $isTaking = true;
                            foreach ($variables as $var) {
                                $var->timespan = $td->textContent;
                            }
                        } else if (preg_match('/geographic coverage/i', $lastText)) {
                            $isTaking = true;
                            foreach ($variables as $var) {
                                $var->coverage = $td->textContent;
                            }
                        } else if (preg_match('/variable description/i', $lastText) && $td->textContent) {
                            $isTaking = true;
                            foreach ($variables as $var) {
                                if (!$var->description)
                                    $var->description = $td->textContent;
                            }
                        }
                        $lastText = $td->textContent;                    
                    }

                    if ($isTaking)
                        $tr->parentNode->removeChild($tr);        
                }

                $source->description = $doc->saveHTML();
                $source->save();
                foreach ($variables as $var) {
                    $var->save();
                }
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
