REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.completar_produccion(uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.completar_produccion(uuid, numeric, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.completar_produccion(uuid, numeric, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.marcar_pedido_listo(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_pedido_listo(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_pedido_listo(uuid, uuid) TO authenticated;