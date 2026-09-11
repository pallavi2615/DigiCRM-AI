
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_target UUID;
  v_action TEXT;
  v_old TEXT;
  v_new TEXT;
  v_target_email TEXT;
  v_actor_email TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_target := NEW.user_id; v_new := NEW.role::text; v_action := 'role_granted';
  ELSIF TG_OP = 'UPDATE' THEN
    v_target := NEW.user_id; v_old := OLD.role::text; v_new := NEW.role::text; v_action := 'role_changed';
  ELSE
    v_target := OLD.user_id; v_old := OLD.role::text; v_action := 'role_revoked';
  END IF;

  SELECT email INTO v_target_email FROM public.profiles WHERE id = v_target;
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.activities (actor_id, entity_type, entity_id, action, description, metadata)
  VALUES (
    v_actor,
    'user_roles',
    v_target,
    v_action,
    COALESCE(v_actor_email, 'system') || ' ' ||
      CASE v_action
        WHEN 'role_granted' THEN 'granted ' || v_new
        WHEN 'role_changed' THEN 'changed ' || COALESCE(v_old,'—') || ' to ' || v_new
        ELSE 'revoked ' || COALESCE(v_old,'—')
      END || ' for ' || COALESCE(v_target_email, v_target::text),
    jsonb_build_object(
      'target_user_id', v_target,
      'target_email', v_target_email,
      'actor_email', v_actor_email,
      'old_role', v_old,
      'new_role', v_new
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_audit ON public.user_roles;
CREATE TRIGGER trg_user_roles_audit
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();
