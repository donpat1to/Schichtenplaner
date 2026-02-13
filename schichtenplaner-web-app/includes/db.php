<?php
/**
 * Database Connection and Helpers
 */

// Create PDO connection
$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    DB_HOST,
    DB_PORT,
    DB_NAME
);

try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // Set MySQL strict mode
    $pdo->exec("SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");

} catch (PDOException $e) {
    if (APP_DEBUG) {
        die('Database connection failed: ' . $e->getMessage());
    } else {
        die('Database connection failed. Please check your configuration.');
    }
}

/**
 * Execute a prepared statement and return the statement
 *
 * @param string $sql SQL query with placeholders
 * @param array $params Parameters to bind
 * @return PDOStatement
 */
function query(string $sql, array $params = []): PDOStatement {
    global $pdo;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

/**
 * Fetch a single row
 *
 * @param string $sql SQL query
 * @param array $params Parameters
 * @return array|null
 */
function fetchOne(string $sql, array $params = []): ?array {
    $result = query($sql, $params)->fetch();
    return $result ?: null;
}

/**
 * Fetch all rows
 *
 * @param string $sql SQL query
 * @param array $params Parameters
 * @return array
 */
function fetchAll(string $sql, array $params = []): array {
    return query($sql, $params)->fetchAll();
}

/**
 * Insert a row and return the last insert ID
 *
 * @param string $table Table name
 * @param array $data Associative array of column => value
 * @return string The inserted ID
 */
function insert(string $table, array $data): string {
    global $pdo;

    $columns = implode(', ', array_keys($data));
    $placeholders = implode(', ', array_fill(0, count($data), '?'));

    $sql = "INSERT INTO {$table} ({$columns}) VALUES ({$placeholders})";
    query($sql, array_values($data));

    return $pdo->lastInsertId() ?: $data['id'] ?? '';
}

/**
 * Update rows in a table
 *
 * @param string $table Table name
 * @param array $data Associative array of column => value to update
 * @param string $where WHERE clause (without WHERE keyword)
 * @param array $whereParams Parameters for WHERE clause
 * @return int Number of affected rows
 */
function update(string $table, array $data, string $where, array $whereParams = []): int {
    $sets = [];
    foreach (array_keys($data) as $column) {
        $sets[] = "{$column} = ?";
    }
    $setClause = implode(', ', $sets);

    $sql = "UPDATE {$table} SET {$setClause} WHERE {$where}";
    $params = array_merge(array_values($data), $whereParams);

    return query($sql, $params)->rowCount();
}

/**
 * Delete rows from a table
 *
 * @param string $table Table name
 * @param string $where WHERE clause
 * @param array $params Parameters for WHERE clause
 * @return int Number of affected rows
 */
function delete(string $table, string $where, array $params = []): int {
    $sql = "DELETE FROM {$table} WHERE {$where}";
    return query($sql, $params)->rowCount();
}

/**
 * Begin a database transaction
 */
function beginTransaction(): void {
    global $pdo;
    $pdo->beginTransaction();
}

/**
 * Commit a database transaction
 */
function commit(): void {
    global $pdo;
    $pdo->commit();
}

/**
 * Rollback a database transaction
 */
function rollback(): void {
    global $pdo;
    $pdo->rollBack();
}
