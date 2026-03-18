
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('--- Checking items table ---');
  const { data: columns, error } = await supabase.rpc('get_table_columns', { table_name: 'items' });
  
  if (error) {
    console.log('Error calling rpc get_table_columns (maybe it doesnt exist, falling back):', error.message);
    // Fallback: try to select one row
    const { data, error: selectError } = await supabase.from('items').select('*').limit(1);
    if (selectError) {
       console.log('Select * error:', selectError.message);
    } else if (data && data.length > 0) {
       console.log('Available columns in items:', Object.keys(data[0]));
    } else {
       console.log('Table items is empty or select failed.');
    }
  } else {
    console.log('Columns in items:', columns.map(c => c.column_name));
  }
  
  console.log('\n--- Checking item_status enum ---');
  try {
    const { data: enumValues, error: enumError } = await supabase.rpc('get_enum_values', { enum_name: 'item_status' });
    if (enumError) {
       console.log('Error getting enum values:', enumError.message);
    } else {
       console.log('item_status enum values:', enumValues);
    }
  } catch (e) {
    console.log('Enum check failed.');
  }
}

checkSchema();
