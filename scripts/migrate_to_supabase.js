require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const supabase = require('../lib/supabase');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function migrate() {
  console.log('Starting migration to Supabase...\n');

  // Migrate orders
  const ordersData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'orders.json'), 'utf8'));
  if (ordersData.orders && ordersData.orders.length > 0) {
    for (const order of ordersData.orders) {
      // Upsert customer
      let customer = null;
      const { data: existingCustomer } = await supabase
        .from('aap_customers')
        .select('id')
        .eq('phone', order.phone)
        .single();

      if (!existingCustomer) {
        const { data: newCustomer } = await supabase
          .from('aap_customers')
          .insert({
            name: order.customerName,
            phone: order.phone,
            address: order.address || '',
          })
          .select('id')
          .single();
        customer = newCustomer;
      } else {
        customer = existingCustomer;
      }

      // Insert order
      const { error } = await supabase.from('aap_orders').insert({
        id: order.id ? undefined : undefined, // let Supabase generate UUID
        customer_id: customer ? customer.id : null,
        customer_name: order.customerName,
        phone: order.phone,
        address: order.address || '',
        items: order.items,
        total: order.total,
        status: order.status || 'pending',
        notes: order.notes || '',
        order_date: order.orderDate || new Date().toISOString(),
      });

      if (error) {
        console.error(`  Error migrating order ${order.id}:`, error.message);
      } else {
        console.log(`  Migrated order: ${order.customerName} - ₹${order.total}`);
      }
    }
  } else {
    console.log('  No orders to migrate.');
  }

  // Migrate subscriptions
  const subsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'subscriptions.json'), 'utf8'));
  if (subsData.subscriptions && subsData.subscriptions.length > 0) {
    for (const sub of subsData.subscriptions) {
      let customer = null;
      const { data: existingCustomer } = await supabase
        .from('aap_customers')
        .select('id')
        .eq('phone', sub.phone)
        .single();

      if (!existingCustomer) {
        const { data: newCustomer } = await supabase
          .from('aap_customers')
          .insert({
            name: sub.customerName,
            phone: sub.phone,
            address: sub.address || '',
          })
          .select('id')
          .single();
        customer = newCustomer;
      } else {
        customer = existingCustomer;
      }

      const { error } = await supabase.from('aap_subscriptions').insert({
        customer_id: customer ? customer.id : null,
        customer_name: sub.customerName,
        phone: sub.phone,
        address: sub.address || '',
        product_id: sub.productId,
        quantity: sub.quantity,
        frequency: sub.frequency,
        price: sub.price,
        status: sub.status || 'active',
        start_date: sub.startDate || null,
        next_delivery: sub.nextDelivery || null,
        notes: sub.notes || '',
      });

      if (error) {
        console.error(`  Error migrating subscription ${sub.id}:`, error.message);
      } else {
        console.log(`  Migrated subscription: ${sub.customerName} - ${sub.productId}`);
      }
    }
  } else {
    console.log('  No subscriptions to migrate.');
  }

  console.log('\nMigration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
