// Check current URL and show appropriate controls
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const currentUrl = tabs[0].url;
  const feedControls = document.getElementById('feed-controls');
  const otherPage = document.getElementById('other-page');
  
  if (currentUrl.includes('linkedin.com/feed')) {
    feedControls.style.display = 'block';
    otherPage.style.display = 'none';
    
    // Get current state
    chrome.storage.local.get(['distractionFree'], function(result) {
      document.getElementById('distraction-free').checked = result.distractionFree || false;
    });
  } else {
    feedControls.style.display = 'none';
    otherPage.style.display = 'block';
  }
});

// Handle toggle changes
document.getElementById('distraction-free').addEventListener('change', function(e) {
  const isEnabled = e.target.checked;
  
  // Save state
  chrome.storage.local.set({ distractionFree: isEnabled });
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { 
      type: 'toggleDistractionFree',
      enabled: isEnabled
    });
  });
}); 