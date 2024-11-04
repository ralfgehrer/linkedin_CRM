from flask import Flask, request, jsonify, render_template, Response, stream_with_context, send_file, redirect, flash
from flask_cors import CORS
import psycopg2
from psycopg2.extras import DictCursor
import os
import random
import csv
import io
from datetime import datetime, timedelta
from dotenv import load_dotenv
from db_init import init_db
import json
import time
import shutil

load_dotenv()

app = Flask(__name__)
# Update CORS settings
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Add template folder configuration
app.template_folder = 'templates'

# Add a global variable for progress tracking
upload_progress = {'processed': 0, 'new_records': 0, 'skipped_records': 0}

def get_db_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

@app.route('/')
def dashboard():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    
    try:
        # Total profiles
        cur.execute('SELECT COUNT(*) FROM profiles')
        total_profiles = cur.fetchone()[0]
        
        # Profiles by category
        cur.execute('''
            SELECT category, COUNT(*) as count 
            FROM profiles 
            WHERE category IS NOT NULL 
            GROUP BY category
        ''')
        categories = dict(cur.fetchall())
        
        # Profiles needing recheck today
        cur.execute('''
            SELECT COUNT(*) 
            FROM profiles 
            WHERE recheck_date <= CURRENT_DATE
        ''')
        needs_recheck = cur.fetchone()[0]
        
        # Recent additions (last 7 days)
        cur.execute('''
            SELECT COUNT(*) 
            FROM profiles 
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        ''')
        recent_additions = cur.fetchone()[0]
        
        # Profiles with notes
        cur.execute('''
            SELECT COUNT(*) 
            FROM profiles 
            WHERE notes IS NOT NULL AND notes != ''
        ''')
        profiles_with_notes = cur.fetchone()[0]
        
        # Average note length
        cur.execute('''
            SELECT AVG(LENGTH(notes)) 
            FROM profiles 
            WHERE notes IS NOT NULL AND notes != ''
        ''')
        avg_note_length = cur.fetchone()[0]
        
        # Most recent updates
        cur.execute('''
            SELECT profile_url, full_name, updated_at, category
            FROM profiles
            WHERE updated_at IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 5
        ''')
        recent_updates = cur.fetchall()
        
        # Connection timeline
        cur.execute('''
            SELECT DATE_TRUNC('month', connection_since) as month,
                   COUNT(*) as count
            FROM profiles
            WHERE connection_since IS NOT NULL
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        ''')
        timeline_data = cur.fetchall()
        
        # Format the timeline data
        connection_timeline = [
            {
                'month': row['month'].strftime('%Y-%m'),
                'count': row['count']
            }
            for row in timeline_data
        ]
        
        return render_template('dashboard.html',
                             total_profiles=total_profiles,
                             categories=categories,
                             needs_recheck=needs_recheck,
                             recent_additions=recent_additions,
                             profiles_with_notes=profiles_with_notes,
                             avg_note_length=int(avg_note_length or 0),
                             recent_updates=recent_updates,
                             connection_timeline=connection_timeline)
                             
    finally:
        cur.close()
        conn.close()

@app.route('/upload')
def upload_page():
    return render_template('upload.html')

@app.route('/upload-progress')
def progress():
    def generate():
        global upload_progress
        while True:
            # Send current progress
            data = json.dumps(upload_progress)
            yield f"data: {data}\n\n"
            time.sleep(0.5)  # Update every 500ms
    
    response = Response(stream_with_context(generate()), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response

@app.route('/upload', methods=['POST', 'OPTIONS'])
def upload_csv():
    global upload_progress
    upload_progress = {'processed': 0, 'new_records': 0, 'skipped_records': 0}
    
    if request.method == 'OPTIONS':
        print("OPTIONS request received")
        return '', 204
    
    print("Files in request:", request.files)
    if 'file' not in request.files:
        print("No file in request")
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    print(f"Received file: {file.filename}")
    
    if file.filename == '':
        print("Empty filename")
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        print("Not a CSV file")
        return jsonify({'error': 'File must be a CSV'}), 400

    try:
        print("Reading file contents")
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        print("Connecting to database")
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("Processing CSV rows")
        for row in csv_reader:
            print(f"Processing row: {upload_progress['processed'] + 1}")
            upload_progress['processed'] += 1
            
            cur.execute('SELECT profile_url FROM profiles WHERE profile_url = %s', (row['profileUrl'],))
            exists = cur.fetchone()
            
            if exists:
                upload_progress['skipped_records'] += 1
                continue
            
            cur.execute('''
                INSERT INTO profiles 
                (profile_url, first_name, last_name, full_name, title, 
                 connection_since, profile_image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (
                row['profileUrl'],
                row['firstName'],
                row['lastName'],
                row['fullName'],
                row['title'],
                row['connectionSince'],
                row['profileImageUrl']
            ))
            upload_progress['new_records'] += 1
        
        conn.commit()
        print("Upload complete:", upload_progress)
        
        return jsonify({
            'status': 'success',
            'new_records': upload_progress['new_records'],
            'skipped_records': upload_progress['skipped_records']
        })
        
    except Exception as e:
        print("Error processing upload:", str(e))
        return jsonify({'error': str(e)}), 500
        
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

@app.route('/notes', methods=['GET', 'POST'])
def handle_notes():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    
    try:
        if request.method == 'POST':
            data = request.json
            recheck_date = data.get('recheck_date')
            # Convert 'null' string or None to NULL in database
            if recheck_date in ['null', '', None]:
                recheck_date = None
                
            cur.execute('''
                UPDATE profiles 
                SET notes = %s,
                    category = %s,
                    recheck_date = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE profile_url = %s
            ''', (
                data['notes'], 
                data.get('category'), 
                recheck_date,  # This will now be None if no date is set
                data['profile_url']
            ))
            conn.commit()
            return jsonify({'status': 'success'})
        
        elif request.method == 'GET':
            profile_url = request.args.get('profile_url')
            cur.execute('''
                SELECT notes, category, recheck_date, first_name, last_name 
                FROM profiles 
                WHERE profile_url = %s
            ''', (profile_url,))
            result = cur.fetchone()
            
            if result:
                return jsonify({
                    'notes': result['notes'] or '',
                    'category': result['category'] or '',
                    'recheck_date': result['recheck_date'].isoformat() if result['recheck_date'] else None,
                    'first_name': result['first_name'] or '',
                    'last_name': result['last_name'] or ''
                })
            return jsonify({})  # Return empty object if no profile found
            
    finally:
        cur.close()
        conn.close()

@app.route('/next-profile', methods=['GET'])
def get_next_profile():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    
    try:
        # 1. First priority: Profiles that need recheck today
        cur.execute('''
            SELECT profile_url 
            FROM profiles 
            WHERE recheck_date <= CURRENT_DATE
            ORDER BY recheck_date ASC
            LIMIT 1
        ''')
        result = cur.fetchone()
        if result:
            return jsonify({'next_profile_url': result['profile_url']})

        # 2. Second priority: Uncategorized profiles, newest connections first
        cur.execute('''
            SELECT profile_url 
            FROM profiles 
            WHERE category IS NULL
            AND connection_since IS NOT NULL
            ORDER BY connection_since DESC
            LIMIT 1
        ''')
        result = cur.fetchone()
        if result:
            return jsonify({'next_profile_url': result['profile_url']})

        # 3. Third priority: Random network or lead without recheck date
        cur.execute('''
            SELECT profile_url 
            FROM profiles 
            WHERE category IN ('network', 'lead')
            AND recheck_date IS NULL
            ORDER BY RANDOM()
            LIMIT 1
        ''')
        result = cur.fetchone()
        if result:
            return jsonify({'next_profile_url': result['profile_url']})

        # If no profiles match any criteria, return error
        return jsonify({
            'error': 'No profiles found matching the prioritization criteria',
            'message': 'All profiles have been categorized and scheduled for recheck'
        }), 404
        
    finally:
        cur.close()
        conn.close()

@app.route('/search', methods=['GET'])
def search_profiles():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
        
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    
    try:
        # Search in full_name, first_name, last_name, and title
        cur.execute('''
            SELECT profile_url, full_name, title, category, updated_at
            FROM profiles
            WHERE 
                LOWER(full_name) LIKE LOWER(%s) OR
                LOWER(first_name) LIKE LOWER(%s) OR
                LOWER(last_name) LIKE LOWER(%s) OR
                LOWER(title) LIKE LOWER(%s)
            ORDER BY updated_at DESC
            LIMIT 10
        ''', (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%'))
        
        results = cur.fetchall()
        return jsonify([dict(row) for row in results])
        
    finally:
        cur.close()
        conn.close()

@app.route('/backup', methods=['GET'])
def backup_database():
    print("\n=== Starting backup process ===")
    try:
        # Create backup directory if it doesn't exist
        backup_dir = os.path.join(os.path.dirname(__file__), 'local_backups')
        print(f"Creating backup directory: {backup_dir}")
        os.makedirs(backup_dir, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(backup_dir, f'local_backup_{timestamp}.csv')
        print(f"Generated backup filename: {backup_file}")
        
        print("Connecting to database...")
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get all data from profiles table
        print("Executing database query...")
        cur.execute('''
            SELECT 
                profile_url,
                first_name,
                last_name,
                full_name,
                title,
                connection_since,
                profile_image_url,
                notes,
                category,
                recheck_date,
                created_at,
                updated_at
            FROM profiles
        ''')
        
        rows = cur.fetchall()
        print(f"Retrieved {len(rows)} records from database")
        
        # Write to CSV
        print(f"Writing data to CSV file: {backup_file}")
        with open(backup_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # Write header
            header = [
                'profile_url',
                'first_name',
                'last_name',
                'full_name',
                'title',
                'connection_since',
                'profile_image_url',
                'notes',
                'category',
                'recheck_date',
                'created_at',
                'updated_at'
            ]
            print("Writing header:", header)
            writer.writerow(header)
            
            # Write data
            print("Writing data rows...")
            writer.writerows(rows)
            print(f"Successfully wrote {len(rows)} rows to CSV")
        
        print("=== Backup process completed successfully ===\n")
        return jsonify({
            'status': 'success',
            'message': f'Backup created: {os.path.basename(backup_file)}',
            'backup_path': backup_file
        })
        
    except Exception as e:
        print(f"!!! ERROR during backup process: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Error details: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
        
    finally:
        print("Cleaning up database connection...")
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()
        print("Database connection closed")

@app.route('/update-name', methods=['POST'])
def update_name():
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        data = request.json
        field = data['field']
        if field not in ['first_name', 'last_name']:
            return jsonify({'error': 'Invalid field'}), 400
            
        cur.execute(f'''
            UPDATE profiles 
            SET {field} = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE profile_url = %s
        ''', (data['value'], data['profile_url']))
        
        conn.commit()
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"Error updating name: {str(e)}")
        return jsonify({'error': str(e)}), 500
        
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    init_db()  # Initialize database on startup
    app.run(debug=True)