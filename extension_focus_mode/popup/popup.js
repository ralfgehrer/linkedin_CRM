document.addEventListener('DOMContentLoaded', function() {
  const focusToggle = document.getElementById('focus-mode');
  const promotedToggle = document.getElementById('hide-promoted');
  const reactionsToggle = document.getElementById('hide-reactions');
  
  // Get current states
  chrome.storage.local.get(['distractionFree', 'hidePromoted', 'hideReactions'], function(result) {
    focusToggle.checked = result.distractionFree || false;
    promotedToggle.checked = result.hidePromoted || false;
    reactionsToggle.checked = result.hideReactions || false;
  });
  
  // Handle focus mode toggle
  focusToggle.addEventListener('change', function(e) {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ distractionFree: isEnabled });
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'toggleDistractionFree',
        enabled: isEnabled
      });
    });
  });

  // Handle promoted posts toggle
  promotedToggle.addEventListener('change', function(e) {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ hidePromoted: isEnabled });
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'toggleHidePromoted',
        enabled: isEnabled
      });
    });
  });

  // Handle reactions toggle
  reactionsToggle.addEventListener('change', function(e) {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ hideReactions: isEnabled });
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'toggleHideReactions',
        enabled: isEnabled
      });
    });
  });
}); 