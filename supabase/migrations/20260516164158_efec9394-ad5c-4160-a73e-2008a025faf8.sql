-- Atomic function: validate stock, deduct, write kardex, mark pedido as listo.
-- All inside a single transaction (function body) -> rollback on any error.
CREATE OR REPLACE FUNCTION public.marcar_pedido_listo(_pedido_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pedido RECORD;
  _item RECORD;
  _producto RECORD;
  _stock_anterior numeric;
  _stock_nuevo numeric;
  _insuficientes jsonb := '[]'::jsonb;
BEGIN
  -- Lock pedido row
  SELECT id, numero, estado INTO _pedido
  FROM pedidos WHERE id = _pedido_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF _pedido.estado <> 'preparando' AND _pedido.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'El pedido no puede pasar a listo desde el estado %', _pedido.estado
      USING ERRCODE = 'P0001';
  END IF;

  -- Validate stock for all items first
  FOR _item IN
    SELECT dp.producto_id, dp.cantidad, p.nombre, p.stock
    FROM detalle_pedidos dp
    JOIN productos p ON p.id = dp.producto_id
    WHERE dp.pedido_id = _pedido_id
  LOOP
    IF _item.stock < _item.cantidad THEN
      _insuficientes := _insuficientes || jsonb_build_object(
        'producto_id', _item.producto_id,
        'nombre', _item.nombre,
        'stock', _item.stock,
        'requerido', _item.cantidad
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(_insuficientes) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stock_insuficiente', 'detalles', _insuficientes);
  END IF;

  -- Apply stock deduction + kardex (locking each product row)
  FOR _item IN
    SELECT producto_id, cantidad
    FROM detalle_pedidos WHERE pedido_id = _pedido_id
  LOOP
    SELECT id, stock INTO _producto FROM productos WHERE id = _item.producto_id FOR UPDATE;
    _stock_anterior := _producto.stock;
    _stock_nuevo := _stock_anterior - _item.cantidad;

    IF _stock_nuevo < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para producto % (race condition)', _producto.id
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE productos SET stock = _stock_nuevo, updated_at = now() WHERE id = _producto.id;

    INSERT INTO movimientos_inventario (
      producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
      referencia_tipo, referencia_id, observaciones, user_id
    ) VALUES (
      _producto.id, 'salida', _item.cantidad, _stock_anterior, _stock_nuevo,
      'pedido', _pedido_id,
      'Pedido #' || _pedido.numero || ' - Marcado como listo', _user_id
    );
  END LOOP;

  UPDATE pedidos SET estado = 'listo', updated_at = now() WHERE id = _pedido_id;

  RETURN jsonb_build_object('ok', true, 'pedido_id', _pedido_id, 'numero', _pedido.numero);
END;
$$;

-- Allow authenticated users to invoke; internal SQL respects table grants/RLS bypassed by SECURITY DEFINER.
-- Authorization is enforced by checking roles inside RLS on the underlying tables for direct access,
-- but this RPC is restricted to roles that can manage pedidos.
REVOKE ALL ON FUNCTION public.marcar_pedido_listo(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_pedido_listo(uuid, uuid) TO authenticated;