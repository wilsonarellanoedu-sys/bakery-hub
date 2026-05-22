export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caja: {
        Row: {
          estado: string
          fecha_apertura: string
          fecha_cierre: string | null
          id: string
          monto_apertura: number
          monto_cierre: number | null
          observaciones: string | null
          user_id: string | null
        }
        Insert: {
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_apertura: number
          monto_cierre?: number | null
          observaciones?: string | null
          user_id?: string | null
        }
        Update: {
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_apertura?: number
          monto_cierre?: number | null
          observaciones?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          apellidos: string | null
          correo: string | null
          created_at: string
          direccion: string | null
          dni: string | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          apellidos?: string | null
          correo?: string | null
          created_at?: string
          direccion?: string | null
          dni?: string | null
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          apellidos?: string | null
          correo?: string | null
          created_at?: string
          direccion?: string | null
          dni?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      compras: {
        Row: {
          fecha: string
          id: string
          igv: number
          numero: number
          proveedor_id: string | null
          subtotal: number
          total: number
          user_id: string | null
        }
        Insert: {
          fecha?: string
          id?: string
          igv?: number
          numero?: number
          proveedor_id?: string | null
          subtotal: number
          total: number
          user_id?: string | null
        }
        Update: {
          fecha?: string
          id?: string
          igv?: number
          numero?: number
          proveedor_id?: string | null
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          correo: string | null
          direccion: string | null
          id: number
          igv_porcentaje: number
          logo_url: string | null
          moneda: string
          nombre_empresa: string
          ruc: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          correo?: string | null
          direccion?: string | null
          id?: number
          igv_porcentaje?: number
          logo_url?: string | null
          moneda?: string
          nombre_empresa?: string
          ruc?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          correo?: string | null
          direccion?: string | null
          id?: number
          igv_porcentaje?: number
          logo_url?: string | null
          moneda?: string
          nombre_empresa?: string
          ruc?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      detalle_compras: {
        Row: {
          cantidad: number
          compra_id: string
          id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad: number
          compra_id: string
          id?: string
          precio_unitario: number
          producto_id?: string | null
          subtotal: number
        }
        Update: {
          cantidad?: number
          compra_id?: string
          id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_compras_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_compras_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      detalle_pedidos: {
        Row: {
          cantidad: number
          id: string
          observaciones: string | null
          pedido_id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad: number
          id?: string
          observaciones?: string | null
          pedido_id: string
          precio_unitario: number
          producto_id?: string | null
          subtotal: number
        }
        Update: {
          cantidad?: number
          id?: string
          observaciones?: string | null
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_pedidos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_pedidos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      detalle_ventas: {
        Row: {
          cantidad: number
          id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          precio_unitario: number
          producto_id?: string | null
          subtotal: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_ventas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          cargo: string | null
          correo: string | null
          created_at: string
          dni: string | null
          estado: boolean
          fecha_ingreso: string | null
          foto_url: string | null
          id: string
          nombre: string
          salario: number | null
          telefono: string | null
          user_id: string | null
        }
        Insert: {
          cargo?: string | null
          correo?: string | null
          created_at?: string
          dni?: string | null
          estado?: boolean
          fecha_ingreso?: string | null
          foto_url?: string | null
          id?: string
          nombre: string
          salario?: number | null
          telefono?: string | null
          user_id?: string | null
        }
        Update: {
          cargo?: string | null
          correo?: string | null
          created_at?: string
          dni?: string | null
          estado?: boolean
          fecha_ingreso?: string | null
          foto_url?: string | null
          id?: string
          nombre?: string
          salario?: number | null
          telefono?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      movimientos_caja: {
        Row: {
          caja_id: string
          concepto: string | null
          fecha: string
          id: string
          monto: number
          tipo: string
          user_id: string | null
        }
        Insert: {
          caja_id: string
          concepto?: string | null
          fecha?: string
          id?: string
          monto: number
          tipo: string
          user_id?: string | null
        }
        Update: {
          caja_id?: string
          concepto?: string | null
          fecha?: string
          id?: string
          monto?: number
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "caja"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          fecha: string
          id: string
          observaciones: string | null
          producto_id: string
          referencia_id: string | null
          referencia_tipo: string | null
          stock_anterior: number | null
          stock_nuevo: number | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          cantidad: number
          fecha?: string
          id?: string
          observaciones?: string | null
          producto_id: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          stock_anterior?: number | null
          stock_nuevo?: number | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          cantidad?: number
          fecha?: string
          id?: string
          observaciones?: string | null
          producto_id?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          stock_anterior?: number | null
          stock_nuevo?: number | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string | null
          created_at: string
          estado: string
          fecha_entrega: string | null
          id: string
          numero: number
          observaciones: string | null
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          estado?: string
          fecha_entrega?: string | null
          id?: string
          numero?: number
          observaciones?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          estado?: string
          fecha_entrega?: string | null
          id?: string
          numero?: number
          observaciones?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produccion: {
        Row: {
          cantidad_producida: number
          cantidad_programada: number
          created_at: string
          estado: string
          fecha_programada: string
          id: string
          observaciones: string | null
          producto_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cantidad_producida?: number
          cantidad_programada: number
          created_at?: string
          estado?: string
          fecha_programada?: string
          id?: string
          observaciones?: string | null
          producto_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cantidad_producida?: number
          cantidad_programada?: number
          created_at?: string
          estado?: string
          fecha_programada?: string
          id?: string
          observaciones?: string | null
          producto_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produccion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          categoria_id: string | null
          codigo: string
          created_at: string
          descripcion: string | null
          estado: boolean
          id: string
          imagen_url: string | null
          nombre: string
          precio_compra: number
          precio_venta: number
          stock: number
          stock_minimo: number
          updated_at: string
        }
        Insert: {
          categoria_id?: string | null
          codigo: string
          created_at?: string
          descripcion?: string | null
          estado?: boolean
          id?: string
          imagen_url?: string | null
          nombre: string
          precio_compra?: number
          precio_venta?: number
          stock?: number
          stock_minimo?: number
          updated_at?: string
        }
        Update: {
          categoria_id?: string | null
          codigo?: string
          created_at?: string
          descripcion?: string | null
          estado?: boolean
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio_compra?: number
          precio_venta?: number
          stock?: number
          stock_minimo?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellidos: string | null
          avatar_url: string | null
          created_at: string
          id: string
          nombre: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellidos?: string | null
          avatar_url?: string | null
          created_at?: string
          id: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellidos?: string | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          nombre?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          contacto: string | null
          correo: string | null
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          ruc: string | null
          telefono: string | null
        }
        Insert: {
          contacto?: string | null
          correo?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          ruc?: string | null
          telefono?: string | null
        }
        Update: {
          contacto?: string | null
          correo?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          ruc?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ventas: {
        Row: {
          caja_id: string | null
          cliente_id: string | null
          descuento: number
          estado: string
          fecha: string
          id: string
          igv: number
          metodo_pago: string
          monto_recibido: number | null
          numero_ticket: number
          subtotal: number
          total: number
          user_id: string | null
          vuelto: number | null
        }
        Insert: {
          caja_id?: string | null
          cliente_id?: string | null
          descuento?: number
          estado?: string
          fecha?: string
          id?: string
          igv?: number
          metodo_pago?: string
          monto_recibido?: number | null
          numero_ticket?: number
          subtotal: number
          total: number
          user_id?: string | null
          vuelto?: number | null
        }
        Update: {
          caja_id?: string | null
          cliente_id?: string | null
          descuento?: number
          estado?: string
          fecha?: string
          id?: string
          igv?: number
          metodo_pago?: string
          monto_recibido?: number | null
          numero_ticket?: number
          subtotal?: number
          total?: number
          user_id?: string | null
          vuelto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      completar_produccion: {
        Args: {
          _cantidad_real: number
          _produccion_id: string
          _user_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      marcar_pedido_listo: {
        Args: { _pedido_id: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "cajero" | "panadero" | "almacen"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "cajero", "panadero", "almacen"],
    },
  },
} as const
