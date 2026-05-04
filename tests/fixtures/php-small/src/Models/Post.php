<?php

namespace App\Models;

use App\Models\User;

class Post
{
    private User $author;

    public function __construct(User $author)
    {
        $this->author = $author;
    }

    public function authorName(): string
    {
        return $this->author->name();
    }
}
