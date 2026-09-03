ALTER TABLE prizes ADD COLUMN IF NOT EXISTS probability INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION validate_prize_probability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.probability < 0 OR NEW.probability > 100 THEN
    RAISE EXCEPTION 'probability must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_prize_probability
  BEFORE INSERT OR UPDATE ON prizes
  FOR EACH ROW EXECUTE FUNCTION validate_prize_probability();