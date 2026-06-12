UPDATE auth.users
   SET email_confirmed_at = COALESCE(email_confirmed_at, now())
 WHERE lower(email) = lower('Soundtrack798@gamil.com');