// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'saveNotes') {
    // Handle saving notes to backend
    fetch('http://localhost:8000/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.data)
    })
    .then(response => response.json())
    .then(data => sendResponse(data))
    .catch(error => console.error('Error:', error));
    
    return true; // Will respond asynchronously
  }
}); 