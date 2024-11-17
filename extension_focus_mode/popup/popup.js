document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('focus-mode');
  
  // Get current state
  chrome.storage.local.get(['distractionFree'], function(result) {
    toggle.checked = result.distractionFree || false;
  });
  
  // Handle toggle changes
  toggle.addEventListener('change', function(e) {
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
}); 