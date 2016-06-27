<?php

use Illuminate\Foundation\Testing\WithoutMiddleware;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use App\Chart;

class EditorTest extends TestCase
{

    /**
     * Helper function for creating a chart
     */
    public function createChart($config=[]) {
        $defaultConfigStr = <<<EOT
{"chart-name":"A test chart","published":true,"chart-slug":"a-test-slug","chart-notes":"","chart-time":null,"cache":true,"selected-countries":[{"id":"142","name":"Myanmar"},{"id":"143","name":"Cote d'Ivoire"},{"id":"123","name":"Lesotho"}],"tabs":["chart","data","sources"],"default-tab":"chart","line-type":0,"line-tolerance":1,"chart-description":"","chart-dimensions":"[{\"variableId\":\"169\",\"property\":\"y\",\"unit\":\"people (thousands)\",\"name\":\"Y axis\",\"period\":\"all\",\"mode\":\"closest\",\"targetYear\":\"2000\",\"tolerance\":\"5\",\"maximumAge\":\"5\"}]","variables":[],"y-axis":{"axis-label-distance":"-10"},"x-axis":{},"margins":{"top":10,"left":60,"bottom":10,"right":10},"units":"[{\"property\":\"y\",\"visible\":true,\"title\":\"\",\"unit\":\"people (thousands)\",\"format\":\"\"}]","logo":"uploads/26538.png","second-logo":null,"iframe-width":"100%","iframe-height":"660px","hide-legend":false,"group-by-variables":false,"add-country-mode":"add-country","x-axis-scale-selector":false,"y-axis-scale-selector":false,"map-config":{"variableId":"169","targetYear":1980,"targetYearMode":"normal","defaultYear":1980,"mode":"specific","timeTolerance":1,"minYear":1980,"maxYear":2000,"timeRanges":[],"timelineMode":"timeline","colorSchemeName":"BuGn","colorSchemeValues":false,"colorSchemeLabels":[],"colorSchemeValuesAutomatic":true,"colorSchemeInterval":5,"colorSchemeInvert":false,"colorSchemeMinValue":null,"customColorScheme":[],"isColorblind":false,"projection":"World","defaultProjection":"World","legendDescription":"","legendStepSize":20,"legendOrientation":"landscape"},"chart-type":"1","form-config":{"variables-collection":[{"id":"169","name":"Total population by broad age group, both sexes, 1950-2100 - 70+","unit":"people (thousands)"}],"dimensions":{"id":"1","success":true,"chartDimensions":[{"id":1,"property":"y","name":"Y axis","type":"number","fk_chart_type_id":"1"},{"id":7,"property":"color","name":"Color","type":"string","fk_chart_type_id":"1"}]}}}
EOT;
    
        $config = array_merge(json_decode($defaultConfigStr, true), $config);
    
        $user = factory(App\User::class)->create();

        return $this->actingAs($user)
             ->post('/charts', $config)
             ->seeJSON([
                 'success' => true
             ])->response->original["data"]["id"];
    }

    public function updateChart($id, $config=[]) {
        $chart = Chart::find($id);

        $config = array_merge(json_decode($chart->config, true), $config);

        $user = factory(App\User::class)->create();

        $this->actingAs($user)
             ->put('/charts/' . $id, $config)
             ->seeJSON([
                 'success' => true
             ]);
    }

    /**
     * Make sure basic chart creation actually works, since I've broken it a couple of times.
     *
     * @return void
     */
    public function testChartCreation()
    {
        $this->createChart([ 
            'chart-name' => "An excellent chart",
            'chart-slug' => "an-excellent-chart"
        ]);


        $this->seeInDatabase('charts', [
            'name' => 'An excellent chart',
            'slug' => 'an-excellent-chart'
        ]);       
    }

    /**
     * @expectedException Illuminate\Database\QueryException
     **/
    public function testChartSlugConflict() {
        $this->createChart([ 'chart-slug' => "slug" ]);
        $this->createChart([ 'chart-slug' => "slug" ]);        
    }

    public function testChartSlugRenameRedirect() {
        $chartId = $this->createChart([ 'chart-name' => "Original chart", 'chart-slug' => "original-slug" ]);
        $this->updateChart($chartId, [ 'chart-slug' => "some-other-slug" ]);

        $this->seeInDatabase('chart_slug_redirects', [
            'slug' => "original-slug",
            'chart_id' => $chartId
        ]);

        $this->visit('/some-other-slug')
            ->see("<title>Original chart");
        
        $this->visit('/original-slug')
            ->see("<title>Original chart");
    }
}
