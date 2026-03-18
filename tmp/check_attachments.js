
const accessToken = "EAAVZA75lL7KsBQyXA8Dh9auouj5jmm5mFZCn4ONFOGTo9rMZBJDoxpzrcaj1EFhnSZCMkCwenRszP5q5ZCY8umi08QyXkQzcyuB2hOfSjchCqeFdKnLb9wy6eWbodiNPqfZC6dT7KkBAr90eOsvEpx6jYkFUmkU3gkomkLjTyFAoiRS3fXAnRhJUGw1v8yvWlgiPSd9U6O6fTRDBuNPkOl7FX8900FhkXiA523THl4kZCQZD";
const postId = "1418678570271597"; // Post ID that might have more than 12 items

async function fetchGraphQL(path) {
    const url = `https://graph.facebook.com/v19.0/${path}&access_token=${accessToken}`;
    const response = await fetch(url);
    if (!response.ok) {
        const error = await response.json();
        console.error("API Error:", error);
        return null;
    }
    return response.json();
}

async function run() {
    console.log(`Checking items for Post: ${postId}`);
    
    // Fetch attachments with more fields
    // Adding .limit(100) to subattachments might help if supported, 
    // but usually subattachments is just a list.
    const data = await fetchGraphQL(`${postId}/attachments?fields=description,media,subattachments{description,media,target}`);
    
    if (!data || !data.data) {
        console.log("No data found.");
        return;
    }

    const items = [];
    for (const attachment of data.data) {
        if (attachment.subattachments) {
            console.log(`Found subattachments: ${attachment.subattachments.data.length}`);
            attachment.subattachments.data.forEach((sub, index) => {
                items.push({
                    index: index + 1,
                    id: sub.target?.id,
                    description: sub.description || "NO DESCRIPTION",
                    url: sub.media?.image?.src
                });
            });
            
            // Check for paging in subattachments
            if (attachment.subattachments.paging) {
                console.log("Subattachments have PAGING!");
                console.log(attachment.subattachments.paging);
            }
        } else {
            items.push({
                index: 1,
                id: attachment.target?.id,
                description: attachment.description || "NO DESCRIPTION",
                url: attachment.media?.image?.src
            });
        }
    }

    console.log(`Total items collected: ${items.length}`);
    items.forEach(item => {
        console.log(`[Item ${item.index}] ID: ${item.id} | Desc: ${item.description.substring(0, 50)}...`);
    });
}

run();
