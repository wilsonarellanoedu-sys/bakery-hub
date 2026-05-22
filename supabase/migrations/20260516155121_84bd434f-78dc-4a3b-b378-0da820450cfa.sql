
-- ============ ROLES & PROFILES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'cajero', 'panadero', 'almacen');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  apellidos TEXT,
  telefono TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)));

  IF NEW.email = 'wilsonarellanoedu@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cajero');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles policies
CREATE POLICY "Users view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ CATEGORÍAS ============
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read categorias" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/almacen manage categorias" ON public.categorias FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'));

-- ============ PRODUCTOS ============
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  precio_compra NUMERIC(10,2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  estado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER productos_updated BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Auth read productos" ON public.productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/almacen manage productos" ON public.productos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'));

-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellidos TEXT,
  dni TEXT UNIQUE,
  telefono TEXT,
  correo TEXT,
  direccion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage clientes" ON public.clientes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'));

-- ============ PROVEEDORES ============
CREATE TABLE public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  ruc TEXT UNIQUE,
  telefono TEXT,
  correo TEXT,
  direccion TEXT,
  contacto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read proveedores" ON public.proveedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/almacen manage proveedores" ON public.proveedores FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'));

-- ============ EMPLEADOS ============
CREATE TABLE public.empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  dni TEXT UNIQUE,
  telefono TEXT,
  correo TEXT,
  cargo TEXT,
  salario NUMERIC(10,2),
  fecha_ingreso DATE,
  estado BOOLEAN NOT NULL DEFAULT true,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read empleados" ON public.empleados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage empleados" ON public.empleados FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ CAJA ============
CREATE TABLE public.caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  monto_apertura NUMERIC(10,2) NOT NULL,
  monto_cierre NUMERIC(10,2),
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  observaciones TEXT
);
ALTER TABLE public.caja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read caja" ON public.caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage caja" ON public.caja FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'));

CREATE TABLE public.movimientos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id UUID NOT NULL REFERENCES public.caja(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  concepto TEXT,
  monto NUMERIC(10,2) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read mov caja" ON public.movimientos_caja FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage mov caja" ON public.movimientos_caja FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'));

-- ============ VENTAS ============
CREATE TABLE public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ticket SERIAL NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  user_id UUID REFERENCES auth.users(id),
  caja_id UUID REFERENCES public.caja(id),
  subtotal NUMERIC(10,2) NOT NULL,
  igv NUMERIC(10,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo','yape','plin','tarjeta','mixto')),
  monto_recibido NUMERIC(10,2),
  vuelto NUMERIC(10,2),
  estado TEXT NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada','anulada')),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read ventas" ON public.ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create ventas" ON public.ventas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admin manage ventas" ON public.ventas FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admin delete ventas" ON public.ventas FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE public.detalle_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.detalle_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read detalle ventas" ON public.detalle_ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage detalle ventas" ON public.detalle_ventas FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor'));

-- ============ COMPRAS ============
CREATE TABLE public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL NOT NULL,
  proveedor_id UUID REFERENCES public.proveedores(id),
  user_id UUID REFERENCES auth.users(id),
  subtotal NUMERIC(10,2) NOT NULL,
  igv NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read compras" ON public.compras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/almacen manage compras" ON public.compras FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'));

CREATE TABLE public.detalle_compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.detalle_compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read detalle compras" ON public.detalle_compras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/almacen manage detalle compras" ON public.detalle_compras FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen'));

-- ============ INVENTARIO MOVIMIENTOS ============
CREATE TABLE public.movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
  cantidad NUMERIC(10,2) NOT NULL,
  stock_anterior NUMERIC(10,2),
  stock_nuevo NUMERIC(10,2),
  referencia_tipo TEXT,
  referencia_id UUID,
  user_id UUID REFERENCES auth.users(id),
  observaciones TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read mov inv" ON public.movimientos_inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage mov inv" ON public.movimientos_inventario FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen') OR public.has_role(auth.uid(), 'cajero'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'almacen') OR public.has_role(auth.uid(), 'cajero'));

-- ============ PRODUCCIÓN ============
CREATE TABLE public.produccion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  cantidad_programada NUMERIC(10,2) NOT NULL,
  cantidad_producida NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','completado','cancelado')),
  fecha_programada DATE NOT NULL DEFAULT CURRENT_DATE,
  observaciones TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produccion ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER produccion_updated BEFORE UPDATE ON public.produccion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Auth read produccion" ON public.produccion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Panadero manage produccion" ON public.produccion FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'panadero') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'panadero') OR public.has_role(auth.uid(), 'supervisor'));

-- ============ PEDIDOS ============
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  fecha_entrega DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','preparando','listo','entregado','cancelado')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pedidos_updated BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Auth read pedidos" ON public.pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage pedidos" ON public.pedidos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'panadero'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'panadero'));

CREATE TABLE public.detalle_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id),
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  observaciones TEXT
);
ALTER TABLE public.detalle_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read detalle pedidos" ON public.detalle_pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage detalle pedidos" ON public.detalle_pedidos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'panadero'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'cajero') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'panadero'));

-- ============ CONFIGURACIÓN ============
CREATE TABLE public.configuracion (
  id INT PRIMARY KEY DEFAULT 1,
  nombre_empresa TEXT NOT NULL DEFAULT 'PANIFICADORA ERP',
  ruc TEXT,
  direccion TEXT,
  telefono TEXT,
  correo TEXT,
  logo_url TEXT,
  moneda TEXT NOT NULL DEFAULT 'S/',
  igv_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 18,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER configuracion_updated BEFORE UPDATE ON public.configuracion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.configuracion (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE POLICY "Auth read config" ON public.configuracion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage config" ON public.configuracion FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ SEED CATEGORÍAS ============
INSERT INTO public.categorias (nombre, descripcion) VALUES
  ('Panes', 'Panes artesanales y tradicionales'),
  ('Pasteles', 'Pasteles y tortas'),
  ('Postres', 'Postres dulces'),
  ('Bebidas', 'Bebidas calientes y frías'),
  ('Insumos', 'Materia prima para producción')
ON CONFLICT (nombre) DO NOTHING;
