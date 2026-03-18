
const pageId = "106158684317724";
const accessToken = "EAAVZA75lL7KsBQyXA8Dh9auouj5jmm5mFZCn4ONFOGTo9rMZBJDoxpzrcaj1EFhnSZCMkCwenRszP5q5ZCY8umi08QyXkQzcyuB2hOfSjchCqeFdKnLb9wy6eWbodiNPqfZC6dT7KkBAr90eOsvEpx6jYkFUmkU3gkomkLjTyFAoiRS3fXAnRhJUGw1v8yvWlgiPSd9U6O6fTRDBuNPkOl7FX8900FhkXiA523THl4kZCQZD";
const startDate = "2026-03-12T00:00:00.000Z";
const endDate = "2026-03-15T23:59:59.999Z";

const sinceTS = Math.floor(new Date(startDate).getTime() / 1000);
const untilTS = Math.floor(new Date(endDate).getTime() / 1000);

async function testFetch(endpoint) {
    const url = `https://graph.facebook.com/v19.0/${pageId}/${endpoint}?fields=id,message,created_time,full_picture&since=${sinceTS}&until=${untilTS}&access_token=${accessToken}`;
    console.log(`\nTesting ${endpoint} endpoint...`);
    console.log(`URL: ${url}`);
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            console.error(`Error in ${endpoint}:`, data.error);
        } else {
            console.log(`Success in ${endpoint}! Found ${data.data?.length || 0} posts.`);
            if (data.data?.length > 0) {
                console.log("First post date:", data.data[0].created_time);
            }
        }
    } catch (err) {
        console.error(`Fatal error in ${endpoint}:`, err);
    }
}

async function run() {
    await testFetch('feed');
    await testFetch('posts');
}

run();
