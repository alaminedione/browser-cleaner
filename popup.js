// popup.js (version corrigée)
async function getBookmarkOrigins() {
  const nodes = await chrome.bookmarks.getTree();
  return extractOrigins(nodes);
}

function extractOrigins(nodes) {
  const origins = new Set();
  const invalidUrls = [];

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
        console.error('URL invalide:', node.url, e);
        invalidUrls.push(node.url);
      }
    }
    node.children?.forEach(processNode);
  }

  nodes.forEach(processNode);
  return { origins: Array.from(origins), invalidUrls };
}

document.getElementById('cleanButton').addEventListener('click', async () => {
  const cleanButton = document.getElementById('cleanButton');
  const statusMessageDiv = document.getElementById('statusMessage');
  const resultsDiv = document.getElementById('results');

  // Clear previous results and status
  resultsDiv.innerHTML = '';
  statusMessageDiv.textContent = 'Nettoyage en cours...';
  cleanButton.disabled = true;

  try {
    const { origins, invalidUrls } = await getBookmarkOrigins();

    if (invalidUrls.length > 0) {
      resultsDiv.innerHTML += `<p style="color: orange;">Attention: ${invalidUrls.length} URL(s) invalide(s) trouvée(s) dans les favoris:</p>`;
      const ul = document.createElement('ul');
      invalidUrls.forEach(url => {
        const li = document.createElement('li');
        li.textContent = url;
        ul.appendChild(li);
      });
      resultsDiv.appendChild(ul);
    }

    // Établir une connexion persistante
    const port = chrome.runtime.connect({ name: "clean-port" });
    port.postMessage({ action: "clean", origins });

    // Gérer la réponse
    port.onMessage.addListener((msg) => {
      cleanButton.disabled = false;
      statusMessageDiv.textContent = ''; // Clear status message

      if (msg.status === "done") {
        resultsDiv.innerHTML += '<p style="color: green;">Nettoyage terminé avec succès!</p>';
      } else if (msg.status === "error") {
        resultsDiv.innerHTML += `<p style="color: red;">Erreur lors du nettoyage: ${msg.message}</p>`;
      }
    });

    port.onDisconnect.addListener(() => {
        cleanButton.disabled = false;
        statusMessageDiv.textContent = ''; // Clear status message
        resultsDiv.innerHTML += '<p style="color: red;">La connexion avec le service de nettoyage a été interrompue.</p>';
    });

  } catch (error) {
    console.error("Error getting bookmark origins:", error);
    cleanButton.disabled = false;
    statusMessageDiv.textContent = '';
    resultsDiv.innerHTML += `<p style="color: red;">Erreur lors de la récupération des favoris: ${error.message}</p>`;
  }
});
