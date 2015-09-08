<?php namespace Zofe\Rapyd\Helpers;

use Illuminate\Support\Facades\DB;

class DataTree extends Widget
{
    public $cid;
    public $source;

    /**
     *
     * @var \Illuminate\Database\Query\Builder
     */
    public $query;

    public $tree;
    public $options;

    public $categories = array();
    public $path = '';
    public $path_separator;
    public $current_cat_id;
    public $separator = ' > ';

    public $field_cat_id;
    public $field_parent_id;
    public $field_label;
    public $hideCatId;

    /**
     * @param $source
     *
     * @return static
     */
    public static function source($source)
    {
        $ins = new static();
        $ins->query = $source;

        //inherit cid from datafilter
        if ($ins->query instanceof \Zofe\Rapyd\DataFilter\DataFilter) {
            $ins->cid = $ins->query->cid;
        }
        //generate new component id
        else {
            $ins->cid = $ins->getIdentifier();
        }

        return $ins;
    }

    protected function table($table)
    {
        $this->query = DB::table($table);

        return $this->query;
    }

    public function getTree($parent_id, $level=0)
    {
        static $tree;

        $cid = $this->field_cat_id;
        $pid = $this->field_parent_id;
        $label = $this->field_label;
        $table = $this->table;
        $orderby = $this->field_orderby;

        $andwhere = '';
        if ($this->hideCatId!="") {
            $notincat = (array) $this->hide_cat_id;
            $andwhere .= ' AND '.$cid.' NOT IN ('.implode(',',$notincat).')';
        }

        $sql = ' SELECT '. $cid.', '. $pid.', '. $label
            .' FROM '.$table
            .' WHERE '.$pid.' = '.$parent_id
            .  $andwhere;

        rpd::$db->query($sql);

        if (rpd::$db->num_rows()) {
            $tree .= "\n".str_repeat("\t", $level)."<ul>\n";
            $rows = rpd::$db->result_array();
            foreach ($rows as $row) {
                $this->options[$row[$cid]] = str_repeat("&nbsp;&nbsp;", $level) . $row[$label];
                $tree .= str_repeat("\t", $level).'<li><p>'.$row[$label];
                $this->get_tree($row[$cid], $level+1);
                $tree .= str_repeat("\t", $level)."</p></li>\n";
            }
            $tree .= str_repeat("\t", $level)."</ul>\n";
        }

        return $tree;
    }

    //breadcrumbs

    public function get_categories()
    {
        $sql = ' SELECT '. $cid.', '. $pid.', '. $label.' FROM '.$table;
        rpd::$db->query($sql);
        if (rpd::$db->num_rows()) {
            $this->categories = rpd::$db->result_array();
        }
    }

    public function get_parent($id)
    {
        foreach ($this->categories as $value) {
            if ($value[$this->field_cat_id] == $id) {
                $this->path = $this->separator.$value[$this->field_label] . $this->path;

                return $value[$this->field_parent_id];
            }
        }

        return 0;
    }

    public function get_path($cat_id)
    {
        $this->get_categories();
        $this->current_cat_id = $cat_id;
        do {
            $this->current_cat_id = $this->get_parent($this->current_cat_id);
        } while ($this->current_cat_id!==0);

        return $this->path;
    }

    public static function tree_from_array($array, $currentParent, $currLevel = 0, $prevLevel = -1)
    {
        foreach ($array as $categoryId => $category) {
            if ($currentParent == $category['parent_id']) {
                if ($currLevel > $prevLevel) echo " <ul> ";
                if ($currLevel == $prevLevel) echo " </li> ";

                echo '<li id="' . $categoryId . '"><span>' . $category['name'] . '</span>';

                if ($currLevel > $prevLevel) {
                    $prevLevel = $currLevel;
                }

                $currLevel++;
                self::tree_from_array($array, $categoryId, $currLevel, $prevLevel);
                $currLevel--;
            }
        }
        if ($currLevel == $prevLevel) echo " </li>  </ul> ";
    }

}
