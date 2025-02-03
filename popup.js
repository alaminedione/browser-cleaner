// popup.js (version corrigée)
async function getBookmarkOrigins() {
  const nodes = await chrome.bookmarks.getTree();
  return extractOrigins(nodes);
}

function extractOrigins(nodes) {
  const origins = new Set();

  function processNode(node) {
    if (node.url) {
      try {
        const url = new URL(node.url);
        origins.add(url.origin);
        // Ajoute le domaine parent pour les sous-domaines
        const domainParts = url.hostname.split('.');
        if (domainParts.length > 2) {
          origins.add(`https://${domainParts.slice(-2).join('.')}`);
          origins.add(`http://${domainParts.slice(-2).join('.')}`);
        }
      } catch (e) {
        console.error('URL invalide:', node.url);
      }
    }
    node.children?.forEach(processNode);
  }

  nodes.forEach(processNode);
  return Array.from(origins);
}

document.getElementById('cleanButton').addEventListener('click', async () => {
  const origins = await getBookmarkOrigins();

  // Établir une connexion persistante
  const port = chrome.runtime.connect({ name: "clean-port" });
  port.postMessage({ action: "clean", origins });

  // Gérer la réponse
  port.onMessage.addListener((msg) => {
    if (msg.status === "done") {
      alert("Cleaning done!");
    }
  });
});


