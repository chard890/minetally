
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugClaims() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('--- Fetching Settings ---');
  const { data: settings, error: settingsError } = await supabase.from('settings').select('*').limit(1);
  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
  } else if (!settings || settings.length === 0) {
    console.log('No settings found in the database. Application will use default values.');
  } else {
    console.log('Settings Found:', settings[0].id);
    console.log('Valid Claim Keywords:', settings[0].valid_claim_keywords_json);
    console.log('Cancel Keywords:', settings[0].cancel_keywords_json);
  }

  console.log('\n--- Fetching Recent Comments (last 20) ---');
  const { data: comments, error: commentError } = await supabase
    .from('comments')
    .select('item_id, comment_text, is_valid_claim, is_cancel_comment')
    .order('commented_at', { ascending: false })
    .limit(20);

  if (commentError) {
    console.error('Error fetching comments:', commentError);
  } else {
    comments.forEach(c => {
      console.log(`Item: ${c.item_id} | Valid: ${c.is_valid_claim} | Cancel: ${c.is_cancel_comment} | Text: "${c.comment_text}"`);
    });
  }
}

debugClaims();
