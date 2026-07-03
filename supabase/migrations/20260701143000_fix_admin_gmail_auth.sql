-- Repair admin@gmail.com auth (manual SQL inserts often produce invalid password hashes).
-- Credentials after apply: admin@gmail.com / Admin@123

CREATE OR REPLACE FUNCTION public._seed_demo_user(p_email TEXT, p_password TEXT, p_name TEXT, p_role public.app_role)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_id, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('full_name', p_name),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      aud = 'authenticated',
      role = 'authenticated',
      raw_app_meta_data = COALESCE(
        raw_app_meta_data,
        jsonb_build_object('provider','email','providers',jsonb_build_array('email'))
      ),
      updated_at = now()
    WHERE id = v_id;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_id AND provider = 'email') THEN
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (
        gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_id, p_email, p_name)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;

  DELETE FROM public.user_roles WHERE user_id = v_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_id, p_role);

  RETURN v_id;
END $$;

SELECT public._seed_demo_user('admin@gmail.com', 'Admin@123', 'Admin', 'admin'::public.app_role);

DROP FUNCTION public._seed_demo_user(TEXT, TEXT, TEXT, public.app_role);
