function createFeedOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'distraction-free-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
      #4a90e2,  /* Lighter blue */
      #5fb7d4,  /* Turquoise */
      #4a90e2   /* Back to lighter blue */
    );
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 90;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    color: white;
    font-size: 72px;
    font-family: 'Playfair Display', Georgia, serif;
    text-align: center;
    letter-spacing: 8px;
    text-transform: uppercase;
    font-weight: 300;
    margin-top: 160px;
  `;
  
  // Load Google Font
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
  
  content.textContent = 'Focus';
  
  overlay.appendChild(content);
  return overlay;
}

function toggleFeedOverlay(enabled) {
  const feedContainer = document.querySelector('main.scaffold-layout__main');
  if (!feedContainer) return;
  
  let overlay = document.getElementById('distraction-free-overlay');
  
  if (enabled) {
    if (!overlay) {
      overlay = createFeedOverlay();
      feedContainer.style.position = 'relative';
      feedContainer.appendChild(overlay);
    }
    overlay.style.opacity = '1';
  } else if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'toggleDistractionFree') {
    toggleFeedOverlay(request.enabled);
  }
});

// Check initial state
chrome.storage.local.get(['distractionFree'], function(result) {
  if (result.distractionFree) {
    toggleFeedOverlay(true);
  }
}); 