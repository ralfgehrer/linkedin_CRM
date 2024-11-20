async function copyTemplateToClipboard(template, firstName) {
  const filledTemplate = template.replace('{{Firstname}}', firstName);
  try {
    await navigator.clipboard.writeText(filledTemplate);
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = 'Template copied to clipboard!';
    statusMessage.className = 'status-success';
    setTimeout(() => {
      statusMessage.textContent = '';
    }, 3000);
  } catch (err) {
    console.error('Failed to copy template:', err);
  }
}

async function getProfileInfo() {
  try {
    // Get and decode the URL properly
    const rawUrl = window.location.href;
    const decodedUrl = decodeURIComponent(rawUrl);
    
    // Clean both versions of the URL
    const cleanUrl = decodedUrl
      .replace('https://www.linkedin.com/in/', '')
      .replace('https://linkedin.com/in/', '')
      .split('?')[0]
      .split('/')[0];
    
    // Try both encoded and decoded versions for the API call
    const response = await fetch(`http://localhost:8000/notes?profile_url=${encodeURIComponent(decodedUrl)}`);
    
    if (!response.ok) {
      // Try fallback with raw URL if decoded version fails
      const fallbackResponse = await fetch(`http://localhost:8000/notes?profile_url=${encodeURIComponent(rawUrl)}`);
      if (!fallbackResponse.ok) {
        throw new Error('Failed to fetch profile info');
      }
      const data = await fallbackResponse.json();
      const profileExists = Object.keys(data).length > 0;
      
      return {
        profileUrl: rawUrl,
        cleanUrl,
        inCRM: profileExists,
        firstName: data.first_name || '',
        lastName: data.last_name || ''
      };
    }
    
    const data = await response.json();
    const profileExists = Object.keys(data).length > 0;
    
    return {
      profileUrl: decodedUrl,
      cleanUrl,
      inCRM: profileExists,
      firstName: data.first_name || '',
      lastName: data.last_name || ''
    };
  } catch (error) {
    console.error('Error checking profile:', error);
    return {
      profileUrl: window.location.href,
      cleanUrl: window.location.href.split('/').pop().split('?')[0],
      inCRM: false,
      firstName: '',
      lastName: ''
    };
  }
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'crm-error';
  errorDiv.textContent = `Error: ${message}`;
  return errorDiv;
}

async function createCRMOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'linkedin-crm-overlay';
  
  // Initial loading state
  overlay.innerHTML = `
    <div class="crm-header">
      <h3>CRM Notes</h3>
      <div class="profile-info">Loading profile info...</div>
    </div>
    <div class="crm-content">
      <div class="loading-spinner"></div>
    </div>
  `;
  
  document.body.appendChild(overlay);

  try {
    const profileInfo = await getProfileInfo();
    
    overlay.innerHTML = `
      <div class="crm-header">
        <h3>CRM Notes</h3>
        <div class="profile-info">
          ${profileInfo.inCRM ? `
            <div class="name-fields">
              <span class="editable-field" id="first-name" title="Double click to edit">${profileInfo.firstName}</span>
              <span class="editable-field" id="last-name" title="Double click to edit">${profileInfo.lastName}</span>
            </div>
          ` : `
            <div class="not-in-crm">
              <span class="red-dot"></span>
              <span class="red-text">Not in CRM</span>
            </div>
          `}
          <div class="profile-url">Profile: ${profileInfo.cleanUrl}</div>
        </div>
      </div>
      <div class="crm-content">
        <textarea id="crm-notes" placeholder="Add notes for this profile..."></textarea>
        
        <div class="smart-dictate-section">
          <div class="suggestion-header">
            <h4>Smart Dictate</h4>
            <button class="record-button" title="Record voice message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="6"/>
              </svg>
            </button>
          </div>
          <div class="suggestion-card">
            <pre id="dictation-text" class="suggestion-preview"></pre>
            <button class="copy-suggestion-btn" title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="templates-section">
          <h4>Templates</h4>
          <div class="template-card">
            <pre class="template-preview">Freut mich mit dir connected zu sein ${profileInfo.firstName}!

Und sorry für die verzögerte Nachricht. Ich baue mir gerade schon eine LinkedIn Erweiterung, die verhindert, dass Kontakte und Nachrichten untergehen. :D 

Habt ihr schon irgendwelche AI Themen integriert. 
Guten Start in die Woche. 
Gruß
Julien</pre>
            <button class="copy-template-btn" title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="category-buttons">
          <h4>Category:</h4>
          <button class="category-btn lead" data-category="lead">Lead</button>
          <button class="category-btn customer" data-category="customer">Customer</button>
          <button class="category-btn network" data-category="network">Network</button>
          <button class="category-btn friend" data-category="friend">Friend</button>
          <button class="category-btn stale" data-category="stale">Stale</button>
        </div>

        <div class="recheck-buttons">
          <h4>Recheck in:</h4>
          <button class="recheck-btn" data-days="1">1 Day</button>
          <button class="recheck-btn" data-days="7">1 Week</button>
          <button class="recheck-btn" data-days="30">1 Month</button>
          <button class="recheck-btn custom" id="custom-recheck">Custom</button>
          <button class="recheck-btn none" id="no-recheck">None</button>
          <input type="date" id="custom-date" style="display: none;">
        </div>

        <div class="recheck-info" id="recheck-info"></div>
        <div class="action-buttons">
          <button id="save-notes">Save</button>
          <button id="save-and-next">Save & Next</button>
        </div>
        <div id="status-message"></div>
      </div>
    `;

    // Add event listeners for category buttons
    document.querySelectorAll('.category-btn').forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons
        document.querySelectorAll('.category-btn').forEach(btn => 
          btn.classList.remove('active'));
        // Add active class to clicked button
        button.classList.add('active');
      });
    });

    // Add event listeners for recheck buttons
    document.querySelectorAll('.recheck-btn').forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all recheck buttons
        document.querySelectorAll('.recheck-btn').forEach(btn => 
          btn.classList.remove('active'));
        
        if (button.id === 'custom-recheck') {
          const dateInput = document.getElementById('custom-date');
          dateInput.style.display = dateInput.style.display === 'none' ? 'block' : 'none';
          return;
        }
        
        if (button.id === 'no-recheck') {
          // Set recheck date to null/empty
          const recheckInfo = document.getElementById('recheck-info');
          recheckInfo.textContent = 'No recheck scheduled';
          recheckInfo.dataset.date = null;
          button.classList.add('active');
          return;
        }

        // Add active class to clicked button
        button.classList.add('active');

        const days = parseInt(button.dataset.days);
        const date = new Date();
        date.setDate(date.getDate() + days);
        updateRecheckInfo(date.toISOString().split('T')[0]);
      });
    });

    // Custom date input handler
    document.getElementById('custom-date').addEventListener('change', (e) => {
      // Remove active class from all recheck buttons
      document.querySelectorAll('.recheck-btn').forEach(btn => 
        btn.classList.remove('active'));
      // Add active class to custom button
      document.getElementById('custom-recheck').classList.add('active');
      updateRecheckInfo(e.target.value);
    });

    function updateRecheckInfo(date) {
      const recheckInfo = document.getElementById('recheck-info');
      recheckInfo.textContent = `Will recheck on: ${date}`;
      recheckInfo.dataset.date = date;
    }

    // Load existing notes from backend
    try {
      const response = await fetch(`http://localhost:8000/notes?profile_url=${encodeURIComponent(profileInfo.profileUrl)}`);
      const data = await response.json();
      document.getElementById('crm-notes').value = data.notes || '';
      
      // Set active category if exists
      if (data.category) {
        const categoryBtn = document.querySelector(`[data-category="${data.category}"]`);
        if (categoryBtn) {
          document.querySelectorAll('.category-btn').forEach(btn => 
            btn.classList.remove('active'));
          categoryBtn.classList.add('active');
        }
      }

      // Set recheck date if exists
      if (data.recheck_date) {
        updateRecheckInfo(data.recheck_date);
        // Find and activate the matching recheck button
        const recheckBtns = document.querySelectorAll('.recheck-btn');
        recheckBtns.forEach(btn => {
          if (btn.id === 'custom-recheck') {
            const customDate = new Date(data.recheck_date);
            const today = new Date();
            const diffDays = Math.round((customDate - today) / (1000 * 60 * 60 * 24));
            
            if (![1, 7, 30].includes(diffDays)) {
              document.getElementById('custom-date').value = data.recheck_date;
              btn.classList.add('active');
            }
          } else {
            const btnDays = parseInt(btn.dataset.days);
            const recheckDate = new Date(data.recheck_date);
            const today = new Date();
            const diffDays = Math.round((recheckDate - today) / (1000 * 60 * 60 * 24));
            
            if (diffDays === btnDays) {
              btn.classList.add('active');
            }
          }
        });
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      document.querySelector('.crm-content').prepend(
        showError('Failed to load notes. Is the backend running?')
      );
    }

    // Save notes
    document.getElementById('save-notes').addEventListener('click', async () => {
      const statusMessage = document.getElementById('status-message');
      statusMessage.textContent = 'Saving...';
      statusMessage.className = 'status-saving';

      const notes = document.getElementById('crm-notes').value;
      const activeCategory = document.querySelector('.category-btn.active');
      const recheckInfo = document.getElementById('recheck-info');

      const data = {
        profile_url: profileInfo.profileUrl,
        notes: notes,
        category: activeCategory ? activeCategory.dataset.category : null,
        recheck_date: recheckInfo ? recheckInfo.dataset.date : null
      };

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'saveNotes',
          data: data
        });
        
        if (response.status === 'success') {
          statusMessage.textContent = 'Notes saved!';
          statusMessage.className = 'status-success';
          setTimeout(() => {
            statusMessage.textContent = '';
          }, 3000);
        } else {
          throw new Error('Save failed');
        }
      } catch (error) {
        console.error('Error saving notes:', error);
        statusMessage.textContent = 'Failed to save notes. Check console for details.';
        statusMessage.className = 'status-error';
      }
    });

    // Save and navigate to next
    async function saveAndNavigateToNext() {
      const statusMessage = document.getElementById('status-message');
      statusMessage.textContent = 'Loading next profile...';
      statusMessage.className = 'status-saving';

      try {
        // Try to save first, but continue even if it fails
        try {
          const notes = document.getElementById('crm-notes').value;
          const activeCategory = document.querySelector('.category-btn.active');
          const recheckInfo = document.getElementById('recheck-info');

          const saveData = {
            profile_url: profileInfo.profileUrl,
            notes: notes,
            category: activeCategory ? activeCategory.dataset.category : null,
            recheck_date: recheckInfo ? recheckInfo.dataset.date : null
          };

          const saveResponse = await chrome.runtime.sendMessage({
            type: 'saveNotes',
            data: saveData
          });
          
          if (saveResponse.status === 'success') {
            console.log('Notes saved successfully');
          }
        } catch (saveError) {
          console.log('Could not save notes:', saveError.message);
          // Just log the error and continue with navigation
        }

        // Always proceed with getting next profile
        const nextProfileResponse = await fetch('http://localhost:8000/next-profile');
        const nextProfileData = await nextProfileResponse.json();

        if (nextProfileData.next_profile_url) {
          const profilePath = nextProfileData.next_profile_url
            .replace('https://www.linkedin.com', '')
            .replace('https://linkedin.com', '');
          
          window.history.pushState({}, '', profilePath);
          window.dispatchEvent(new PopStateEvent('popstate'));

          setTimeout(() => {
            const existingOverlay = document.getElementById('linkedin-crm-overlay');
            if (existingOverlay) {
              existingOverlay.remove();
            }
            createCRMOverlay();
          }, 1000);

          statusMessage.textContent = 'Navigated to next profile!';
          statusMessage.className = 'status-success';
        } else {
          throw new Error('No next profile available');
        }

      } catch (error) {
        console.error('Error navigating to next profile:', error);
        statusMessage.textContent = 'Failed to find next profile. Check console for details.';
        statusMessage.className = 'status-error';
      }
    }

    document.getElementById('save-and-next').addEventListener('click', saveAndNavigateToNext);

    // Add event listeners for editable fields
    if (profileInfo.inCRM) {
      ['first-name', 'last-name'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        field.addEventListener('dblclick', function() {
          const currentValue = this.textContent;
          const input = document.createElement('input');
          input.value = currentValue;
          input.className = 'editable-input';
          
          // Replace span with input
          this.parentNode.replaceChild(input, this);
          input.focus();
          
          // Handle save on enter or blur
          const saveEdit = async () => {
            const newValue = input.value.trim();
            const span = document.createElement('span');
            span.className = 'editable-field';
            span.id = fieldId;
            span.title = 'Double click to edit';
            span.textContent = newValue;
            
            // Save to backend
            try {
              const response = await fetch('http://localhost:8000/update-name', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  profile_url: profileInfo.profileUrl,
                  field: fieldId === 'first-name' ? 'first_name' : 'last_name',
                  value: newValue
                })
              });
              
              if (!response.ok) throw new Error('Failed to update name');
              
            } catch (error) {
              console.error('Error updating name:', error);
              // Show error but keep the new value
            }
            
            input.parentNode.replaceChild(span, input);
            // Reattach double click listener
            span.addEventListener('dblclick', field.ondblclick);
          };
          
          input.addEventListener('blur', saveEdit);
          input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') {
              const span = document.createElement('span');
              span.className = 'editable-field';
              span.id = fieldId;
              span.title = 'Double click to edit';
              span.textContent = currentValue;
              input.parentNode.replaceChild(span, input);
              span.addEventListener('dblclick', field.ondblclick);
            }
          });
        });
      });
    }

    // Add this in your event listeners section
    document.querySelector('.copy-template-btn').addEventListener('click', () => {
      const templateText = `Freut mich mit dir connected zu sein ${profileInfo.firstName}!

Und sorry für die verzögerte Nachricht. Ich baue mir gerade schon eine LinkedIn Erweiterung, die verhindert, dass Kontakte und Nachrichten untergehen. :D 

Habt ihr schon irgendwelche AI Themen integriert. 

Guten Start in die Woche. 
Gruß
Julien`;
      copyTemplateToClipboard(templateText, profileInfo.firstName);
    });

    // Add new voice recording functionality
    addVoiceMessageButton(overlay);

  } catch (error) {
    console.error('Error setting up CRM overlay:', error);
    overlay.innerHTML = `
      <div class="crm-header">
        <h3>CRM Notes</h3>
        <div class="crm-error">Error: ${error.message}</div>
      </div>
    `;
  }
}

// Create or update overlay when URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    const existingOverlay = document.getElementById('linkedin-crm-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    if (location.href.includes('linkedin.com/in/')) {
      createCRMOverlay();
    }
  }
}).observe(document, {subtree: true, childList: true});

// Initial creation
if (window.location.href.includes('linkedin.com/in/')) {
  createCRMOverlay();
} 

function extractProfileContent() {
    const profileData = {
        headline: '',
        about: '',
        experience: '',
        skills: ''
    };

    try {
        // Get the main content section
        const mainContent = document.querySelector('main.scaffold-layout__main');
        if (mainContent) {
            // Get all text content from the main section
            const fullText = mainContent.textContent.trim()
                .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
                .replace(/\n+/g, '\n'); // Replace multiple newlines with single newline

            profileData.about = fullText;
            console.log('Extracted profile content:', fullText);
        }

        return profileData;
    } catch (error) {
        console.error('Error extracting profile content:', error);
        return profileData;
    }
}

function extractMessageHistory() {
    try {
        // Get all message groups
        const messageGroups = document.querySelectorAll('.msg-s-message-list__event');
        if (!messageGroups.length) {
            console.log('No message thread found');
            return null;
        }

        // Extract messages with sender info
        const messages = Array.from(messageGroups).map(group => {
            const sender = group.querySelector('.msg-s-message-group__name')?.textContent?.trim();
            const messageContent = group.querySelector('.msg-s-event-listitem__body')?.textContent?.trim();
            const timestamp = group.querySelector('.msg-s-message-group__timestamp')?.textContent?.trim();
            
            return {
                sender,
                content: messageContent,
                timestamp
            };
        }).filter(msg => msg.sender && msg.content);

        console.log('Extracted messages:', messages);
        return messages;
    } catch (error) {
        console.error('Error extracting message history:', error);
        return null;
    }
}

// Add new voice recording functionality
function addVoiceMessageButton(overlay) {
    const recordButton = overlay.querySelector('.record-button');
    const copyButton = overlay.querySelector('.copy-suggestion-btn');
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    // Add copy button functionality
    copyButton.addEventListener('click', async () => {
        const dictationText = document.getElementById('dictation-text').textContent;
        try {
            await navigator.clipboard.writeText(dictationText);
            
            // Visual feedback
            copyButton.classList.add('copied');
            const originalTitle = copyButton.title;
            copyButton.title = 'Copied!';
            
            // Show status message
            const statusMessage = document.getElementById('status-message');
            statusMessage.textContent = 'Text copied to clipboard!';
            statusMessage.className = 'status-success';
            
            // Reset after 2 seconds
            setTimeout(() => {
                copyButton.classList.remove('copied');
                copyButton.title = originalTitle;
                statusMessage.textContent = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
            const statusMessage = document.getElementById('status-message');
            statusMessage.textContent = 'Failed to copy text';
            statusMessage.className = 'status-error';
        }
    });

    recordButton.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg-3' });
                    
                    // Get profile content for reference
                    const profileContent = extractProfileContent();
                    
                    // Create form data
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.mp3');
                    formData.append('profile_content', JSON.stringify(profileContent));

                    // Show processing status
                    const dictationArea = document.getElementById('dictation-text');
                    dictationArea.textContent = 'Processing voice message...';

                    try {
                        const response = await fetch('http://localhost:8000/process-voice-message', {
                            method: 'POST',
                            body: formData
                        });

                        const data = await response.json();
                        if (data.status === 'success') {
                            dictationArea.textContent = data.message;
                        } else {
                            throw new Error(data.message);
                        }
                    } catch (error) {
                        console.error('Error processing voice message:', error);
                        dictationArea.textContent = 'Error processing voice message. Please try again.';
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                recordButton.style.backgroundColor = '#dc3545';
                recordButton.querySelector('svg circle').style.fill = '#dc3545';
            } catch (error) {
                console.error('Error starting recording:', error);
            }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            recordButton.style.backgroundColor = '';
            recordButton.querySelector('svg circle').style.fill = 'none';
        }
    });
} 