function getProfileInfo() {
  return new Promise((resolve) => {
    const profileUrl = window.location.href;
    // Strip the linkedin.com part and clean the URL
    const cleanUrl = profileUrl
      .replace('https://www.linkedin.com/in/', '')
      .replace('https://linkedin.com/in/', '')
      .split('?')[0] // Remove query parameters
      .split('/')[0]; // Remove any trailing paths
    
    resolve({
      profileUrl,
      cleanUrl
    });
  });
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
        <div class="profile-info">Profile: ${profileInfo.cleanUrl}</div>
      </div>
      <div class="crm-content">
        <textarea id="crm-notes" placeholder="Add notes for this profile..."></textarea>
        
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
        if (button.id === 'custom-recheck') {
          const dateInput = document.getElementById('custom-date');
          dateInput.style.display = dateInput.style.display === 'none' ? 'block' : 'none';
          return;
        }

        // Remove active class from all recheck buttons
        document.querySelectorAll('.recheck-btn').forEach(btn => 
          btn.classList.remove('active'));
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
      const response = await fetch(`http://localhost:5000/notes?profile_url=${encodeURIComponent(profileInfo.profileUrl)}`);
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
      statusMessage.textContent = 'Saving and loading next profile...';
      statusMessage.className = 'status-saving';

      try {
        // First save the current notes
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

        if (saveResponse.status !== 'success') {
          throw new Error('Failed to save notes');
        }

        // Then get the next profile
        const nextProfileResponse = await fetch('http://localhost:5000/next-profile');
        const nextProfileData = await nextProfileResponse.json();

        if (nextProfileData.next_profile_url) {
          // Instead of using window.location.href, find and click the next profile link
          const profilePath = nextProfileData.next_profile_url
            .replace('https://www.linkedin.com', '')
            .replace('https://linkedin.com', '');
          
          // Create a navigation event that LinkedIn's router will handle
          const navEvent = new PopStateEvent('popstate');
          const oldURL = window.location.href;
          
          // Update the URL without reload
          window.history.pushState({}, '', profilePath);
          window.dispatchEvent(navEvent);

          // Wait for the profile to load and recreate the overlay
          setTimeout(() => {
            if (oldURL !== window.location.href) {
              const existingOverlay = document.getElementById('linkedin-crm-overlay');
              if (existingOverlay) {
                existingOverlay.remove();
              }
              createCRMOverlay();
            }
          }, 1000);

          statusMessage.textContent = 'Saved and navigated!';
          statusMessage.className = 'status-success';
        } else {
          throw new Error('No next profile available');
        }

      } catch (error) {
        console.error('Error in save and next:', error);
        statusMessage.textContent = 'Failed to save and navigate. Check console for details.';
        statusMessage.className = 'status-error';
      }
    }

    document.getElementById('save-and-next').addEventListener('click', saveAndNavigateToNext);

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