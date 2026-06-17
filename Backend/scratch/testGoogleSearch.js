const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load .env from Backend folder

const customsearch = google.customsearch('v1');

async function testGoogleSearch(keyword) {
  try {
    const key = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;
    console.log(`Using Key: ${key ? key.substring(0, 10) + '...' : 'undefined'}`);
    console.log(`Using CX: ${cx}`);
    
    const res = await customsearch.cse.list({
      cx: cx,
      key: key,
      q: keyword,
      searchType: 'image',
      num: 1
    });
    
    if (res.data.items && res.data.items.length > 0) {
      console.log(`✅ Success: ${res.data.items[0].link}`);
      return res.data.items[0].link;
    } else {
      console.log("❌ No items found in response.");
    }
  } catch (err) {
    console.error("❌ Google Custom Search Error:", err.message);
    if (err.response && err.response.data) {
      console.error("Error Details:", JSON.stringify(err.response.data));
    }
  }
}

testGoogleSearch("apple");
