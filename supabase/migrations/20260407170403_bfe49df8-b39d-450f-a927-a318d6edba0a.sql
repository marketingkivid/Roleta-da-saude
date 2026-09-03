CREATE OR REPLACE FUNCTION validate_prize_probability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.probability < 0 OR NEW.probability > 100 THEN
    RAISE EXCEPTION 'probability must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;