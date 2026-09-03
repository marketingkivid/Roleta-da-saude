-- Populate slugs for existing campaigns
UPDATE campaigns SET slug = 'ativacao' WHERE id = '6f91a31d-60fd-477e-8714-4714ae4e08ff' AND slug IS NULL;
UPDATE campaigns SET slug = 'teste' WHERE id = 'e38b88e7-8941-4dd5-a582-630a26e75e96' AND slug IS NULL;

-- Make slug NOT NULL
ALTER TABLE campaigns ALTER COLUMN slug SET NOT NULL;