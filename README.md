# LinkedIn CRM Extension

A Chrome extension that adds CRM functionality to LinkedIn profiles with a PostgreSQL backend.

## Project Structure
```
linkedin_crm/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── db_init.py            # Database initialization script
│   ├── models.py             # SQLAlchemy models
│   ├── alembic.ini           # Alembic configuration
│   ├── migrations/           # Database migrations
│   ├── initial_database_content/
│   │   └── LinkedIn Database.csv  # Initial profile data
│   └── requirements.txt      # Python dependencies
├── extension/
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── content/
│   │   ├── content.js
│   │   └── content.css
│   └── background.js
└── README.md
```

## Prerequisites

- Python 3.8+
- PostgreSQL
- Google Chrome
- Node.js (optional, for development)

## Backend Setup

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows, use `.venv\Scripts\activate`
   ```

2. Install dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Set up the environment variables:
   Create a `.env` file in the backend directory with:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/linkedin_crm
   OPENAI_API_KEY=your_openai_api_key
   MY_NAME="Your Name"
   ```

4. Initialize the database: (Should be only needed if you plan on making changes to the database schema)
   ```bash
   # Initialize migrations
   alembic init migrations

   # Create initial migration
   alembic revision --autogenerate -m "Initial migration"

   # Apply migrations
   python db_init.py
   ```

5. Start the Flask server:
   ```bash
   python app.py
   ```

6. Load the initial data:

   Go to Localhost:5000 and load the initial data. Check the console for progress and errors.

## Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" in the top right

3. Click "Load unpacked" and select the `extension` folder

## Development

### Database Migrations

To create a new migration after modifying models:
```bash
alembic revision --autogenerate -m "Description of changes"
```

To apply migrations:
```bash
alembic upgrade head
```

To rollback migrations:
```bash
alembic downgrade -1
```

To view migration history:
```bash
alembic history
```

### Troubleshooting

- If the extension doesn't appear, check Chrome's developer console for errors
- If notes aren't saving, ensure the Flask server is running and check the console for CORS errors
- For database issues, check the PostgreSQL logs and ensure the connection string is correct

## Features

- Persistent notes for LinkedIn profiles
- Contact categorization (Lead, Customer, Network, Friend, Stale)
- Recheck scheduling (1 Day, 1 Week, 1 Month, Custom)
- Quick navigation between profiles
- Automatic data persistence
- Database migrations support

## Security Notes

- The extension requires access to LinkedIn and localhost for API calls
- Database credentials should be kept secure and never committed to version control
- Use environment variables for all sensitive configuration
