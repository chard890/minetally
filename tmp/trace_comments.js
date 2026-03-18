
const pageId = "106158684317724";
const accessToken = "EAAVZA75lL7KsBQyXA8Dh9auouj5jmm5mFZCn4ONFOGTo9rMZBJDoxpzrcaj1EFhnSZCMkCwenRszP5q5ZCY8umi08QyXkQzcyuB2hOfSjchCqeFdKnLb9wy6eWbodiNPqfZC6dT7KkBAr90eOsvEpx6jYkFUmkU3gkomkLjTyFAoiRS3fXAnRhJUGw1v8yvWlgiPSd9U6O6fTRDBuNPkOl7FX8900FhkXiA523THl4kZCQZD";
const mediaId = "1418677213605066"; // Media ID from logs that HAS comments

async function fetchGraphQL(path) {
    const url = `https://graph.facebook.com/v19.0/${path}&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
}

async function run() {
    console.log(`Tracing comments for Media: ${mediaId}`);
    
    // 1. Get media comments
    const comments = await fetchGraphQL(`${mediaId}/comments?fields=id,from,message,created_time`);
    console.log(`Comments found: ${comments.data?.length || 0}`);
    if (comments.data?.length > 0) {
        comments.data.forEach(c => {
            console.log(`  - [${c.from?.name} (${c.from?.id})]: "${c.message}" AT ${c.created_time}`);
        });
    } else if (comments.error) {
        console.error("Error:", comments.error);
    }
}

run();
