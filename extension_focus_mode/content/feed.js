function createFeedOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'distraction-free-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #f5f8fa;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 90;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    margin-top: 48px;
    color: rgba(0, 0, 0, 0.9);
    font-size: 24px;
    font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    text-align: center;
    letter-spacing: 0.5px;
    font-weight: 400;
    line-height: 1.4;
  `;
  
  content.innerHTML = `
    <div style="opacity: 0.9">Focus Mode Active</div>
    <div style="font-size: 16px; margin-top: 8px; opacity: 0.6">Take a moment to concentrate on what matters</div>
  `;
  
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
    if (element.textContent.includes('Promoted') || element.textContent.includes('Anzeige')) {
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
        header.textContent.includes('supports this') ||
        header.textContent.includes('reposted') ||
        // German translations
        header.textContent.includes('gefällt das') ||
        header.textContent.includes('Kontakte folgen') ||
        header.textContent.includes('kommentiert') ||
        header.textContent.includes('applaudiert') ||
        header.textContent.includes('folgt')) {
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