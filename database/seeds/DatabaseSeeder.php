<?php

use Illuminate\Database\Seeder;
use Illuminate\Database\Eloquent\Model;

class DatabaseSeeder extends Seeder {

	/**
	 * Run the database seeds.
	 *
	 * @return void
	 */
	public function run()
	{
		Model::unguard();

		$this->call('UsersTableSeeder');
		$this->call('InputFilesTableSeeder');
		
		$this->call('LicencesTableSeeder');

		$this->call('EntityTypesTableSeeder');
		$this->call('VariableTypesTableSeeder');
		$this->call('TimeTypesTableSeeder');
		
		$this->call('EntityIsoNamesTableSeeder');

		$this->call('DatasetCategoriesTableSeeder');
		$this->call('DatasetSubcategoriesTableSeeder');
		
		$this->call('ChartTypesTableSeeder');
		$this->call('ChartTypeDimensionsTableSeeder');
		
		/*$this->call('DatasourcesTableSeeder');
		$this->call('EntitiesTableSeeder');
		$this->call('TimesTableSeeder');
		$this->call('DatasetsTableSeeder');
		$this->call('VariablesTableSeeder');
		$this->call('DataValuesTableSeeder');*/
		

	}

}
