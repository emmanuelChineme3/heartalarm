UPDATE auth.users
   SET encrypted_password = crypt('Nixxan2009$', gen_salt('bf')),
       updated_at = now()
 WHERE lower(email) = lower('Soundtrack798@gamil.com');