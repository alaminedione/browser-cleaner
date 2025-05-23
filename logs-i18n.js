// Fonction pour appliquer les traductions
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageKey = element.dataset.i18n;
    if (chrome.i18n.getMessage(messageKey)) {
      element.textContent = chrome.i18n.getMessage(messageKey);
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const messageKey = element.dataset.i18nPlaceholder;
    if (chrome.i18n.getMessage(messageKey)) {
      element.placeholder = chrome.i18n.getMessage(messageKey);
    }
  });
}

// Appliquer les traductions au chargement du DOM
document.addEventListener('DOMContentLoaded', applyTranslations);

// Observer les changements dans le DOM pour appliquer les traductions aux éléments ajoutés dynamiquement
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    if (mutation.addedNodes.length > 0) {
      applyTranslations();
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });