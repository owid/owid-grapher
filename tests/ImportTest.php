<?php

use Illuminate\Foundation\Testing\WithoutMiddleware;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class ImportTest extends TestCase
{
    /**
     * Importer test.
     *
     * @return void
     */
    public function testImport()
    {

        $user = factory(App\User::class)->create();
        $categoryId = factory(App\DatasetCategory::class)->create()->id;
        $subcategoryId = factory(App\DatasetSubcategory::class)->create()->id;
        $sourceId = factory(App\Datasource::class)->create()->id;

        $requestData = [
            'dataset' => [
                'name' => 'New Dataset',
                'description' => 'New dataset description.',
                'categoryId' => $categoryId,
                'subcategoryId' => $subcategoryId,
                'sourceId' => $sourceId
            ],
            'source' => [
                'name' => 'New Source',
                'description' => 'New source description.'
            ],
            'variables' => []
        ];

        $this->actingAs($user)
    		 ->post('/import/variables', $requestData)
    		 ->seeJson([
    		 	'success' => true,
    		 ]);

        $this->seeInDatabase('datasets', [
            'name' => 'New Dataset',
            'description' => 'New dataset description.',
            'fk_dst_cat_id' => $categoryId,
            'fk_dst_subcat_id' => $subcategoryId,
            'fk_dsr_id' => $sourceId
        ]);
    }
}
