<?php
namespace App\Core;

class Request
{
    private ?array $body = null;

    public function __construct(public array $params, public ?array $user) {}

    public function body(): array
    {
        if ($this->body === null) {
            $raw = file_get_contents('php://input');
            $this->body = $raw ? (json_decode($raw, true) ?? []) : [];
        }
        return $this->body;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body()[$key] ?? $default;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }
}
