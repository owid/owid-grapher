<?php namespace Zofe\Rapyd\Demo;

/**
 * Author
 */
class Author extends \Eloquent
{

    protected $table = 'demo_users';

    protected $appends = array('fullname');

    public function articles()
    {
        return $this->hasMany('Zofe\Rapyd\Models\Article');
    }

    public function comments()
    {
        return $this->hasMany('Zofe\Rapyd\Models\Comment');
    }

    public function getFullnameAttribute($value)
    {
        return $this->firstname ." ". $this->lastname;
    }

}
