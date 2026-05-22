CREATE OR REPLACE FUNCTION public.completar_produccion(
  _produccion_id uuid,
  _cantidad_real numeric,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prod RECORD;
  _producto RECORD;
  _stock_anterior numeric;
  _stock_nuevo numeric;
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.is_admin(_caller)
    OR public.has_role(_caller, 'supervisor'::app_role)
    OR public.has_role(_caller, 'panadero'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF _cantidad_real IS NULL OR _cantidad_real <= 0 THEN
    RAISE EXCEPTION 'La cantidad producida debe ser mayor a 0' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, producto_id, estado, cantidad_programada
    INTO _prod
  FROM produccion
  WHERE id = _produccion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tanda de producción no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF _prod.estado = 'completado' OR _prod.estado = 'cancelado' THEN
    RAISE EXCEPTION 'La tanda ya está en estado %', _prod.estado USING ERRCODE = 'P0001';
  END IF;

  SELECT id, stock INTO _producto
  FROM productos WHERE id = _prod.producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto asociado no encontrado' USING ERRCODE = 'P0002';
  END IF;

  _stock_anterior := _producto.stock;
  _stock_nuevo := _stock_anterior + _cantidad_real;

  UPDATE productos
    SET stock = _stock_nuevo, updated_at = now()
    WHERE id = _producto.id;

  INSERT INTO movimientos_inventario (
    producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
    referencia_tipo, referencia_id, observaciones, user_id
  ) VALUES (
    _producto.id, 'entrada', _cantidad_real, _stock_anterior, _stock_nuevo,
    'produccion', _produccion_id,
    'Producción completada (programada: ' || _prod.cantidad_programada || ')',
    COALESCE(_user_id, _caller)
  );

  UPDATE produccion
    SET estado = 'completado',
        cantidad_producida = _cantidad_real,
        updated_at = now()
    WHERE id = _produccion_id;

  RETURN jsonb_build_object(
    'ok', true,
    'produccion_id', _produccion_id,
    'stock_anterior', _stock_anterior,
    'stock_nuevo', _stock_nuevo
  );
END;
$$;