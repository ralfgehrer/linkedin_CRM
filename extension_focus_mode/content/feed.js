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
    align-items: center;
    justify-content: center;
    z-index: 90;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 72px;
    font-family: 'Playfair Display', Georgia, serif;
    text-align: center;
    letter-spacing: 8px;
    text-transform: uppercase;
    font-weight: 300;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
  // Target the main feed section specifically
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

function hidePromotedPosts() {
  const promotedPosts = document.querySelectorAll('.update-components-actor__description');
  promotedPosts.forEach(element => {
    if (element.textContent.includes('Promoted')) {
      const postContainer = element.closest('.feed-shared-update-v2');
      if (postContainer) {
        postContainer.style.display = 'none';
        postContainer.dataset.hiddenPromoted = 'true';
      }
    }
  });
}

function showPromotedPosts() {
  const hiddenPosts = document.querySelectorAll('[data-hidden-promoted="true"]');
  hiddenPosts.forEach(post => {
    post.style.display = '';
    post.removeAttribute('data-hidden-promoted');
  });
}

let promotedObserver = null;

function startPromotedObserver() {
  if (!promotedObserver) {
    promotedObserver = new MutationObserver(() => {
      hidePromotedPosts();
    });
    promotedObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function stopPromotedObserver() {
  if (promotedObserver) {
    promotedObserver.disconnect();
    promotedObserver = null;
  }
}

function hideReactionPosts() {
  // Find all posts with reaction headers
  const reactionHeaders = document.querySelectorAll('.update-components-header__text-view');
  reactionHeaders.forEach(header => {
    // Check if text contains "likes" or "loves" or "commented on"
    if (header.textContent.includes('likes') || 
        header.textContent.includes('loves') || 
        header.textContent.includes('commented on') ||
        header.textContent.includes('finds this funny') ||
        header.textContent.includes('celebrates this') ||
        header.textContent.includes('follows') ||
        header.textContent.includes('connections follow') ||
        header.textContent.includes('reposted')) {
      // Find the parent post container and hide it
      const postContainer = header.closest('.feed-shared-update-v2');
      if (postContainer) {
        postContainer.style.display = 'none';
        postContainer.dataset.hiddenReaction = 'true';
      }
    }
  });
}

function showReactionPosts() {
  const hiddenPosts = document.querySelectorAll('[data-hidden-reaction="true"]');
  hiddenPosts.forEach(post => {
    post.style.display = '';
    post.removeAttribute('data-hidden-reaction');
  });
}

let reactionObserver = null;

function startReactionObserver() {
  if (!reactionObserver) {
    reactionObserver = new MutationObserver(() => {
      hideReactionPosts();
    });
    reactionObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function stopReactionObserver() {
  if (reactionObserver) {
    reactionObserver.disconnect();
    reactionObserver = null;
  }
}

// Function to initialize features based on current URL
function initializeFeatures() {
  chrome.storage.local.get(['distractionFree', 'hidePromoted', 'hideReactions'], function(result) {
    if (result.distractionFree) {
      toggleFeedOverlay(true);
    }
    if (result.hidePromoted) {
      hidePromotedPosts();
      startPromotedObserver();
    }
    if (result.hideReactions) {
      hideReactionPosts();
      startReactionObserver();
    }
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'toggleDistractionFree') {
    toggleFeedOverlay(request.enabled);
  } else if (request.type === 'toggleHidePromoted') {
    if (request.enabled) {
      hidePromotedPosts();
      startPromotedObserver();
    } else {
      stopPromotedObserver();
      showPromotedPosts();
    }
  } else if (request.type === 'toggleHideReactions') {
    if (request.enabled) {
      hideReactionPosts();
      startReactionObserver();
    } else {
      stopReactionObserver();
      showReactionPosts();
    }
  }
});

// Initialize on page load
initializeFeatures();

// Listen for URL changes (for single-page app navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.includes('/feed')) {
      initializeFeatures();
    }
  }
}).observe(document, { subtree: true, childList: true });