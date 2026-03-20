INSERT INTO "Category" ("name", "slug", "createdAt", "updatedAt")
VALUES ('Математика тест', 'math-test-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING id;