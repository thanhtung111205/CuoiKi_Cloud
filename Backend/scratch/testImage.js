async function testImageSearch(keyword) {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(keyword)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`;
    console.log(`Searching Wikimedia for: ${keyword}...`);
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.query && data.query.pages) {
      const pages = data.query.pages;
      const firstPageId = Object.keys(pages)[0];
      const imageInfo = pages[firstPageId].imageinfo;
      if (imageInfo && imageInfo[0] && imageInfo[0].url) {
        console.log(`✅ Success: ${imageInfo[0].url}`);
        return imageInfo[0].url;
      }
    }
    
    console.log("❌ No images found in Wikimedia. Using picsum.photos fallback.");
    const fallback = `https://picsum.photos/seed/${encodeURIComponent(keyword)}/320/240`;
    console.log(`Fallback: ${fallback}`);
    return fallback;
  } catch (err) {
    console.error("Error searching image:", err.message);
    return `https://picsum.photos/seed/${encodeURIComponent(keyword)}/320/240`;
  }
}

testImageSearch("understanding");
testImageSearch("apple");
testImageSearch("singapore");
