<?php
 
use Illuminate\Database\Seeder;
 
class DatasetSubcategoriesTableSeeder extends Seeder {

	public function run()
	{
		// Uncomment the below to wipe the table clean before populating
		DB::table('dataset_subcategories')->delete();
		
		//reset autoincrement
		$statement = "ALTER TABLE dataset_subcategories AUTO_INCREMENT = 1;";
		DB::unprepared($statement);
		
		$dataset_subcategories = array(
			
			[ 'name' => 'World Population', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'World Population Growth', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'World Fertility Rate, World Life Expectancy and Forecasts of World Population', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Pop.&PopDist of Single Countries', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'The Distribution of World Population', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Mortality Rates', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Fertility Rates', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Determinants of Fertility (Social and Individual)', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Population Growth & Demographic Transition', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Age Structure', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Vital Statistics Quality of Data & History', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Infant & Child Mortality', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Determinants of Child Mortality', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Life Expectancy', 'fk_dst_cat_id' => 1 ],
			[ 'name' => 'Survival Curves and Age-Specific Mortality', 'fk_dst_cat_id' => 1 ],

			[ 'name' => 'Maternal Health & Mortality', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Health Care, Doctors & Health Workers', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Health Spending & Price of Health & Insurance of Health', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Medical Research & Innovation', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Contraception & Abortions', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Teenage Marriage, Pregnancy', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Health in Global Perspective', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Hygiene', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Causes of Death', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Tuberculosis', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Cancer', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'HIV / AIDS & STIs', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Malaria', 'fk_dst_cat_id' => 2 ],
			[ 'name' => '(Neglected) Tropical Diseases', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Infectious Disease', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Noncommunicable Diseases', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Eradications of Diseases (Polio, Smallpox and more)', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Epidemics & Crises', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Disabilities & Chronic Diseases (Onset and Prevalence)', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'DALY Healthy Years of Live Years', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Dental Health', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Bones & Joints', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Plastic Surgery', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Human Genome', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Vaccination Coverage & Success', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Medicine & Pharmaceuticals', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Antibiotics (Price & Spread)', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Blood Donations', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Organ Donation', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Global Inequality of Health', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Within Society Inequality of Health', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Exposure to Toxins', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Suicides', 'fk_dst_cat_id' => 2 ],
			[ 'name' => 'Psychological Problems', 'fk_dst_cat_id' => 2 ],

			[ 'name' => 'Food Consumption – Food per Capita (kcal/person)', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Energy Requirements of Humans', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Hunger & Undernourishment — Quantitative Undernourishment / Malnourishment', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Famines', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Output & Productivity', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Output Agricultural Production & Food Availability', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Productivity (Output/Input) of Agriculture', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Agricultural Employment – Labor Use in Agriculture', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Land Use in Agriculture', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Yields, Seeds, Fertilizer and Pesticides', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Yields (quantity per area)', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Improved Seeds & GMO', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Fertilizer', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Pesticides', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Organic Farming', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Agricultural Research', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Irrigation of Land', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Soil Loss & Soil Quality', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Agricultural Subsidies & Tariffs', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Food Stocks', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Food Waste', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Food Prices', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Food Price Volatility & Food Trade', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Food Quality and Changing Food Consumption Basket', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Human Height', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Obesity & BMI', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Impact of Climate Change on Food Supply', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Farms & Agricultural Machinery', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Agricultural Machinery & Technology', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Farms', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Non-food Crops (Biofuels,..', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Drugs & Alcohol Consumption', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Smoking & Lung Cancer', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Marijuana', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Meat & Animals', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Productivity per animal', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Meat & Livestock Counts', 'fk_dst_cat_id' => 3 ],
			[ 'name' => 'Seafood', 'fk_dst_cat_id' => 3 ],
			
		);
		
		// Uncomment the below to run the seeder
		DB::table('dataset_subcategories')->insert($dataset_subcategories);
	}

}

?>