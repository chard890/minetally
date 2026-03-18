
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkComments() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('--- Fetching Recent Comments (last 10) ---');
  const { data: comments, error: commentError } = await supabase
    .from('comments')
    .select('commenter_id, commenter_name, comment_text, is_valid_claim')
    .order('commented_at', { ascending: false })
    .limit(10);

  if (commentError) {
    console.error('Error fetching comments:', commentError);
  } else {
    console.log(JSON.stringify(comments, null, 2));
  }
}

checkComments();
