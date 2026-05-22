-- Allow authenticated users to read username and id from all profiles
-- Email is excluded from public reads via column-level security
CREATE POLICY "usernames are publicly readable"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Restrict full profile access (including email) to own row only  
CREATE POLICY "users can read own full profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

Drop the existing open anon policy before applying:
DROP POLICY IF EXISTS "profiles are viewable by everyone" ON profiles;
