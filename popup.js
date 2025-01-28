// popup.js
document.getElementById('cleanButton').addEventListener('click', async () => {
  const bookmarks = await chrome.bookmarks.getTree();
  const urls = extractUrls(bookmarks);
  chrome.runtime.sendMessage({ action: "cleanData", urls });
});

function extractUrls(nodes) {
  let domains = [];
  nodes.forEach(node => {
    if (node.url) {
      const url = new URL(node.url);
      domains.push(url.hostname);
      // Inclure le domaine racine (ex: "example.com" pour "blog.example.com")
      domains.push(url.hostname.split('.').slice(-2).join('.'));
    }
    if (node.children) domains = domains.concat(extractUrls(node.children));
  });
  return [...new Set(domains)];
}
