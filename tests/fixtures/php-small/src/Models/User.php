<?php

namespace App\Models;

class User
{
    private string $name;

    public function __construct(string $name)
    {
        $this->name = $name;
    }

    public function classify(int $score): string
    {
        switch ($score) {
            case 0:
                return 'zero';
            case 1:
            case 2:
                return 'low';
            default:
                return 'other';
        }
    }

    public function name(): string
    {
        return $this->name;
    }
}

function private_helper(): int
{
    return 42;
}
