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

        //var_dump($statement);
        DB::statement($statement);
    }

    public function sync() {
        $now = Carbon::now()->toDateTimeString();

        $this->info("Creating datasets and categories to store QoG data");

        // Create a single top-level category representing QoG data
        $this->idempotentInsert("dataset_categories", ["name"], ["QoG Standard Dataset"]);
        $categoryId = DB::select("SELECT id FROM dataset_categories WHERE name='Qog Standard Dataset'")[0]->id;

        // Create QoG categories as OWID subcategories
        $subcategoryCodeToName = [
            'cat_id' => "Identification Variables",
            'cat_health' => "Health", 
            'cat_educ' => "Education", 
            'cat_civil' => "Civil Society", 
            'cat_confl' => "Conflict/Violence", 
            'cat_elec' => "Election", 
            'cat_energy' => "Energy and Infrastructure", 
            'cat_env' => "Environment", 
            'cat_polsys' => "Political System", 
            'cat_jud' => "Judicial", 
            'cat_qog' => "Quality of Government", 
            'cat_mig' => "Migration", 
            'cat_media' => "Media", 
            'cat_welfare' => "Welfare", 
            'cat_econpub' => "Public Economy", 
            'cat_econpriv' => "Private Economy", 
            'cat_labour' => "Labour Market", 
            'cat_religion' => "Religion", 
            'cat_history' => "History"
        ];

        $columns = ["name", "fk_dst_cat_id"];
        $values = [];
        $subcategories = array_values($subcategoryCodeToName);
        foreach ($subcategories as $name) {
            $values[]= $name;
            $values[]= $categoryId;
        }
        $this->idempotentInsert("dataset_subcategories", $columns, $values);
        $subcategoryNameToId = DB::table('dataset_subcategories')
            ->select('id', 'name')
            ->lists('id', 'name');

        // Create a dataset for each of the subcategories
        $columns = ['namespace', 'name', 'description', 'fk_dst_cat_id', 'fk_dst_subcat_id', 'updated_at'];
        $values = [];
        foreach ($subcategories as $name) {
            $values[]= 'qog';
            $values[]= "{$name}";
            $values[]= "Quality of Government Institute - Standard Dataset ({$name})";
            $values[]= $categoryId;
            $values[]= $subcategoryNameToId[$name];
            $values[]= $now;
        }
        $this->idempotentInsert("datasets", $columns, $values);
        $datasetNameToId = DB::table('datasets')
            ->where('namespace', '=', 'qog')
            ->select('id', 'name')
            ->lists('id', 'name');

        $this->info("Reading sources from metadata file");

        $metadataPath = public_path() . "/../tmp/metadata_part.csv";
        $handle = fopen($metadataPath, 'r');
        $header = fgetcsv($handle);

        $columns = ['name', 'description', 'updated_at'];
        $values = [];        
        $prefixToSourceName = [];
        while ($row = fgetcsv($handle)) {
            $data = [];
            for ($i = 0; $i < sizeof($row); $i++) {
                $data[$header[$i]] = $row[$i];
            }

            $isSource = !$data['variable'];
            if (!$isSource) continue;

            $sourceName = $data['datasource'];
            $sourceLink = $data['url'];
            $retrievalDate = $data['date'];
            $prefix = $data['reference'];
            $originalDataset = $data['dataset'];
            $sourceDesc = $data['description'];            

            if (!$prefix) continue;

            $html = "<table>";
            $html .= "<tr><td>Data publisher</td><td>University of Gothenburg: The Quality of Government Institute</td></tr>";
            $html .= "<tr><td>Dataset</td><td>The Quality of Government Standard Dataset</td></tr>";
            if ($sourceName)
                $html .= "<tr><td>Original source</td><td>{$sourceName}</td></tr>";
            if ($originalDataset)
                $html .= "<tr><td>Original dataset</td><td>{$originalDataset}</td></tr>";
            if ($sourceLink)
                $html .= "<tr><td>Link</td><td>{$sourceLink}</td></tr>";
            if ($retrievalDate)
                $html .= "<tr><td>Retrieved</td><td>{$retrievalDate}</td></tr>";
            if ($sourceDesc)
                $html .= "<p>{$sourceDesc}</p>";                    
            $html .= "</table>";

            $values[]= $sourceName . " via the Quality of Government Institute";
            $values[]= $html;
            $values[]= $now;

            $prefixToSourceName[$prefix] = $sourceName  . " via the Quality of Government Institute";
        }

        $this->idempotentInsert("datasources", $columns, $values);

        $sourceNameToId = DB::table('datasources')
            ->select('id', 'name')
            ->lists('id', 'name');


        $this->info("Reading variables from metadata file");
        fseek($handle, 0);
        $header = fgetcsv($handle);

        $columns = ["name", "code", "fk_dst_id", "fk_dsr_id", "fk_var_type_id", "uploaded_by", "uploaded_at", "updated_at"];
        $values = [];
        while ($row = fgetcsv($handle)) {
            $data = [];
            for ($i = 0; $i < sizeof($row); $i++) {
                $data[$header[$i]] = $row[$i];
            }

            $isVariable = !!$data['variable'];
            // Ignore country code meta variable
            if (!$isVariable) continue;

            // Figure out which dataset and source to attach this to by checking category
            $datasetId = null;
            $sourceId = null;
            foreach (array_keys($subcategoryCodeToName) as $code) {
                if ($data[$code] == "1") {
                    $subcategory = $subcategoryCodeToName[$code];                    
                    $datasetId = $datasetNameToId[$subcategory];
                    $prefix = explode('_', $data['varname'])[0];
                    if (isset($prefixToSourceName[$prefix]))
                        $sourceId = $sourceNameToId[$prefixToSourceName[$prefix]];
                    break;
                }
            }

            if ($sourceId == null || $datasetId == null) {
                $this->info("Ignoring variable with missing source or category information: {$data['varname']}");
                continue;
            }

            $values[]= str_replace("\\", "", $data['varlab']) . " (" . $data['varname'] . ")";
            $values[]= $data['varname'];
            $values[]= $datasetId;
            $values[]= $sourceId;
            $values[]= 4;
            $values[]= 'jaiden';
            $values[]= $now;
            $values[]= $now;            
        }
        $this->idempotentInsert("variables", $columns, $values);

        // Now read the entities and data values
        $entityNameToId = DB::table('entities')
            ->select('id', 'name')
            ->lists('id', 'name');

        $variableCodeToId = DB::table('variables')
            ->whereIn('fk_dst_id', array_values($datasetNameToId))
            ->select('id', 'code')
            ->lists('id', 'code');

        $this->info("Removing old data values");
        foreach (array_values($variableCodeToId) as $variableId) {
            DB::statement("DELETE FROM data_values WHERE fk_var_id=?", [$variableId]);
        }

        $this->info("Importing data values from CSV");

        $path = public_path() . "/../tmp/qog_std_ts_jan16.csv";
        $handle = fopen($path, 'r');
        $header = fgetcsv($handle);
        fgetcsv($handle);

        DB::statement("SET foreign_key_checks=0;");
        $columns = ['fk_var_id', 'fk_ent_id', 'year', 'value'];
        $values = [];

        $count = 0;
        $ignoredVariables = [];
        while ($row = fgetcsv($handle)) {
            $entityName = $row[1];
            if (!isset($entityNameToId[$entityName])) {
                $this->idempotentInsert("entities", ["name"], [$entityName]);
                $entityNameToId[$entityName] = DB::select("SELECT id FROM entities WHERE name=?", [$entityName])[0]->id;
            }

            $entityId = intval($entityNameToId[$entityName]);
            $year = intval($row[2]);
            for ($i = 9; $i < sizeof($row); $i++) {            
                $value = $row[$i];
                if ($value == "") continue;

                if (!isset($variableCodeToId[$header[$i]])) {
                    if (!isset($ignoredVariables[$header[$i]])) {
                        $this->info("Ignoring variable with no associated metadata: {$header[$i]}");
                        $ignoredVariables[$header[$i]] = true;
                    }
                    continue;
                }

                $varId = intval($variableCodeToId[$header[$i]]);
 
                $values[]= $varId;
                $values[]= $entityId;
                $values[]= $year;
                $values[]= $value;
            }

            $count += 1;
            if ($count % 200 == 0) {
                $this->insert("data_values", $columns, $values);
                $values = [];
                $this->info($count);
            }
        }

        // Final insert
        if (sizeof($values) > 0)
            $this->idempotentInsert("data_values", $columns, $values);            
        DB::statement("SET foreign_key_checks=1;");
    }

    public function handle() {
//        DB::transaction(function() {
            $this->sync();            
//        });
    }
}
