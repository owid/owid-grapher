<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Source;

class PutLinkAndRetrievalBackOnSources extends Migration
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

                $html = "";
                if ($source->link)
                	$html .= "<tr><td>Link</td><td>" . $source->link  . "</td></tr>";
               	if ($source->retrieved)
               		$html .= "<tr><td>Retrieved</td><td>" . $source->retrieved . "</td></tr>";
               	$html .= "</table>";

               	$source->description = preg_replace('/<\/table>/', $html, $source->description);
                $source->save();
            }

            DB::statement("ALTER TABLE sources DROP COLUMN link, DROP COLUMN retrieved");
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
