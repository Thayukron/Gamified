<?php
namespace App\Core;

class Router
{
    /** @var array<int, array{method:string, pattern:string, handler:callable, roles:array}> */
    private array $routes = [];

    /** POST routes that may run as a background job (long AI calls) — see BackgroundJob. */
    private array $background = [];

    public function add(string $method, string $path, callable $handler, array $roles = []): void
    {
        // "/courses/{id}" -> "#^/courses/(?P<id>[^/]+)$#"
        $pattern = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $path) . '$#';
        $this->routes[] = compact('method', 'pattern', 'handler', 'roles', 'path');
    }

    public function background(string ...$paths): void
    {
        array_push($this->background, ...$paths);
    }

    public function get(string $p, callable $h, array $roles = []): void    { $this->add('GET', $p, $h, $roles); }
    public function post(string $p, callable $h, array $roles = []): void   { $this->add('POST', $p, $h, $roles); }
    public function put(string $p, callable $h, array $roles = []): void    { $this->add('PUT', $p, $h, $roles); }
    public function delete(string $p, callable $h, array $roles = []): void { $this->add('DELETE', $p, $h, $roles); }

    public function dispatch(string $method, string $path): void
    {
        $methodMatched = false;
        foreach ($this->routes as $route) {
            if (!preg_match($route['pattern'], $path, $m)) {
                continue;
            }
            $methodMatched = true;
            if ($route['method'] !== $method) {
                continue;
            }
            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
            $user = null;
            if ($route['roles']) {
                $user = Auth::require($route['roles']);
                // after a reset the user must choose a new password before using anything else
                if (!empty($user['must_change_password']) && !in_array($path, ['/auth/me', '/auth/logout', '/me/profile', '/me/password'], true)) {
                    throw new HttpException(403, 'กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน');
                }
            }
            $request = new Request($params, $user);
            if ($user && ($_SERVER['HTTP_X_ASYNC_JOB'] ?? '') === '1' && in_array($route['path'], $this->background, true)) {
                BackgroundJob::start((int) $user['id'], $path, fn () => ($route['handler'])($request));
            }
            $result = ($route['handler'])($request);
            Response::json($result);
        }
        throw new HttpException($methodMatched ? 405 : 404, $methodMatched ? 'Method not allowed' : 'Not found');
    }
}
