import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

// Esta ruta corre en el servidor (nunca en el navegador del cliente).
// Es la única forma en que un pedido digital puede crearse, y su
// trabajo principal es NO CONFIAR en nada que venga del navegador
// excepto "qué producto" y "cuántos" — el precio y la validez de la
// mesa siempre se recalculan aquí, contra la base de datos real.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, tableId, customerName, items } = body as {
      branchId?: string;
      tableId?: string;
      customerName?: string;
      items?: { productId: string; quantity: number }[];
    };

    if (
      !branchId ||
      !tableId ||
      !customerName ||
      !customerName.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json({ error: 'Faltan datos del pedido.' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1) La mesa debe existir, estar activa, y pertenecer a ESTA sede.
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, branch_id, is_active')
      .eq('id', tableId)
      .single();

    if (tableError || !table || table.branch_id !== branchId || !table.is_active) {
      return NextResponse.json(
        { error: 'La mesa seleccionada no es válida para esta sede.' },
        { status: 400 }
      );
    }

    // 2) Traemos los precios REALES desde la base de datos. Cualquier
    //    precio que haya llegado desde el navegador se ignora por completo.
    const productIds = items.map((i) => i.productId);
    const { data: dbProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, currency, is_available, branch_id')
      .in('id', productIds)
      .eq('branch_id', branchId);

    if (productsError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json({ error: 'Productos no válidos.' }, { status: 400 });
    }

    let total = 0;
    let currency = 'COP';
    const orderItemsData: {
      product_id: string;
      product_name: string;
      unit_price: number;
      quantity: number;
      subtotal: number;
    }[] = [];

    for (const item of items) {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product || !product.is_available) {
        return NextResponse.json(
          { error: 'Uno de los productos ya no está disponible.' },
          { status: 400 }
        );
      }
      const quantity = Math.max(1, Math.floor(item.quantity) || 1);
      const subtotal = product.price * quantity;
      total += subtotal;
      currency = product.currency;

      orderItemsData.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: product.price,
        quantity,
        subtotal,
      });
    }

    // 3) El número de pedido sigue el mismo contador del turno actual
    //    que usa el dashboard (así el orden queda claro para la cocina).
    const { data: nextNumberData, error: nextNumberError } = await supabase.rpc(
      'next_order_number',
      { p_branch_id: branchId }
    );

    if (nextNumberError) {
      return NextResponse.json(
        { error: 'No se pudo generar el número de pedido.' },
        { status: 500 }
      );
    }

    const orderNumber = nextNumberData as string;

    // 4) Generamos nosotros mismos el id y el token del pedido, porque
    //    este cliente anónimo no tiene permiso para "leer de vuelta" el
    //    pedido recién creado (por seguridad, ver Paso 1). Al generarlos
    //    aquí, no necesitamos leerlos después.
    const orderId = randomUUID();
    const publicToken = randomUUID();

    // 4) Creamos el pedido. El company_id lo calcula automáticamente
    //    la base de datos a partir del branch_id (ver Paso 5), así que
    //    no hace falta enviarlo.
    const { error: orderError } = await supabase.from('orders').insert([
      {
        id: orderId,
        public_token: publicToken,
        order_number: orderNumber,
        branch_id: branchId,
        table_id: tableId,
        customer_name: customerName.trim(),
        status: 'PREPARING',
        total_amount: total,
        currency,
      },
    ]);

    if (orderError) {
      return NextResponse.json(
        { error: 'No se pudo crear el pedido: ' + orderError.message },
        { status: 400 }
      );
    }

    // 5) Guardamos el detalle de productos.
    const itemsToInsert = orderItemsData.map((item) => ({
      ...item,
      order_id: orderId,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) {
      return NextResponse.json(
        { error: 'El pedido se creó, pero falló al guardar el detalle: ' + itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ publicToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}