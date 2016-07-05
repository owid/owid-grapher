<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use DB;
use Carbon\Carbon;

class QoGSyncCommand extends Command
{
    protected $signature = 'sync:qog';
    protected $description = 'Sync QoG Institute Standard Dataset from CSV file into the database';

    public function __construct() {
        parent::__construct();
    }

    public function idempotentInsert($table, $columns, $values) {
        $pdo = DB::connection()->getPdo();

        $statement = "INSERT INTO " . $table . " (";

        for ($i = 0; $i < sizeof($columns); $i++) {
            $statement .= $columns[$i] . ($i != sizeof($columns)-1 ? "," : "");
        }

        $statement .= ") VALUES ";

        for ($i = 0; $i < sizeof($values); $i++) {
            if ($i % sizeof($columns) == 0) {
                if ($i == 0)
                    $statement .= "(";
                else
                    $statement .= "),(";
            } else if ($i != 0) {
                $statement .= ",";
            }

            $statement .= $pdo->quote($values[$i]);
        }

        $statement .= ") ON DUPLICATE KEY UPDATE ";

        for ($i = 0; $i < sizeof($columns); $i++) {
            $statement .= $columns[$i] . "=VALUES(" . $columns[$i] . ")" . ($i != sizeof($columns)-1 ? "," : "");
        }

        //var_dump($statement);
        DB::statement($statement);
    }

    public function insert($table, $columns, $values) {
        $pdo = DB::connection()->getPdo();

        $statement = "INSERT INTO " . $table . " (";

        for ($i = 0; $i < sizeof($columns); $i++) {
            $statement .= $columns[$i] . ($i != sizeof($columns)-1 ? "," : "");
        }

        $statement .= ") VALUES ";

        for ($i = 0; $i < sizeof($values); $i++) {
            if ($i % sizeof($columns) == 0) {
                if ($i == 0)
                    $statement .= "(";
                else
                    $statement .= "),(";
            } else if ($i != 0) {
                $statement .= ",";
            }

            $statement .= $pdo->quote($values[$i]);
        }

        $statement .= ")";

        DB::statement($statement);
    }

    public function syncVariables($datasetId, $header) {
        $columns = ["name", "fk_dst_id", "fk_var_type_id", "uploaded_by", "uploaded_at", "updated_at"];
        $values = [];
        $now = Carbon::now()->toDateTimeString();

        for ($i = 0; $i < sizeof($header); $i++) {
            if ($i < 9) continue;
            $values[]= $header[$i];
            $values[]= $datasetId;
            $values[]= 4;
            $values[]= "jaiden";
            $values[]= $now;
            $values[]= $now;
/*            $newVariable = [
                'name' => $variable['name'],
                'description' => $variable['description'],
                'unit' => $variable['unit'],
                'fk_var_type_id' => $variable['typeId'],
                'fk_dst_id' => $datasetId,
                'fk_dsr_id' => $sourceId,
                'uploaded_by' => \Auth::user()->name, 
                'uploaded_at' => Carbon::now(),
                'updated_at' => Carbon::now()
            ];*/
        }

        $this->idempotentInsert("variables", $columns, $values);
    }

    public function sync() {
        $path = public_path() . "/../tmp/qog_std_ts_jan16.csv";

        $handle = fopen($path, 'r');
        $header = NULL;

        $now = Carbon::now()->toDateTimeString();

        $this->idempotentInsert("datasets", 
            ["name", "description", "fk_dst_cat_id", "fk_dst_subcat_id", "updated_at"], 
            ["QoG Standard", "Quality of Government Institute - Standard Dataset", 17, 17, $now]
        );
        $datasetId = DB::select("SELECT id FROM datasets WHERE name='QoG Standard'")[0]->id;

        $header = fgetcsv($handle);
        $this->syncVariables($datasetId, $header);

        $this->info("Reading entities from CSV");

        $entities = [];
        $entityCheck = [];
        $count = 0;
        /*while ($row = fgetcsv($handle)) {
            $entity = $row[1];
            if (!isset($entityCheck[$entity])) {
                $entities[]= $entity;
                $entityCheck[$entity] = true;
            }

            $count += 1;
            if ($count % 1000 == 0)
                $this->info($count);
        } */    

        $this->info("Writing entities to database");
        //$this->idempotentInsert("entities", ["name"], $entities);

        $entityNameToId = DB::table('entities')
            ->select('id', 'name')
            //->whereIn('name', $entities)
            ->lists('id', 'name');

        $varNameToId = DB::table('variables')
            ->select('id', 'name')
            ->whereIn('name', $header)
            ->lists('id', 'name');

        $this->info("Removing old data values");
        DB::statement("DELETE FROM data_values WHERE fk_var_id IN (" . implode(array_values($varNameToId), ",") . ")");

        $this->info("Importing data values from CSV");
        fseek($handle, 0);
        fgetcsv($handle);

        $columns = ['fk_var_id', 'fk_ent_id', 'year', 'value'];
        $values = [];

        $count = 0;
        while ($row = fgetcsv($handle)) {
            $entityId = intval($entityNameToId[$row[1]]);
            $year = intval($row[2]);
            for ($i = 9; $i < sizeof($row); $i++) {
                $varId = intval($varNameToId[$header[$i]]);
                $value = $row[$i];

                $values[]= $varId;
                $values[]= $entityId;
                $values[]= $year;
                $values[]= $value;
            }

            $count += 1;
            if ($count % 10 == 0) {
                $this->insert("data_values", $columns, $values);
                $values = [];
                $this->info($count);
                return;
            }
        }

        // Final insert
        if (sizeof($values) > 0)
            $this->idempotentInsert("data_values", $columns, $values);            
    }

    public function handle() {
        DB::transaction(function() {
            $this->sync();            
        });
    }
}
