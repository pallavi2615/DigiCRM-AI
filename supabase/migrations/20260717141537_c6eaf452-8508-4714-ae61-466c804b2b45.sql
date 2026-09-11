
REVOKE ALL ON FUNCTION public.is_tenant_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) TO authenticated, service_role;
