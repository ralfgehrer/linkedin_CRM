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
from time import time
import shutil
from collections import deque
from threading import Lock
from openai import OpenAI
import pytz

load_dotenv()

app = Flask(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPEN_AI_KEY'))

# Global variable for my name
MY_NAME = os.getenv('MY_NAME')

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

# Cache for next profiles
next_profiles_cache = deque(maxlen=10)  # Store next 10 profiles
cache_lock = Lock()  # Thread-safe operations

def get_db_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def refresh_profile_cache():
    """Refresh the cache with next 3 profiles"""
    with cache_lock:
        while len(next_profiles_cache) < 3:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=DictCursor)
            
            try:
                # Skip profiles that are already in cache
                cached_urls = [p['profile_url'] for p in next_profiles_cache]
                
                # 1. First priority: Profiles that need recheck today
                cur.execute('''
                    SELECT profile_url 
                    FROM profiles 
                    WHERE recheck_date <= CURRENT_DATE
                    AND profile_url NOT IN %s
                    ORDER BY recheck_date ASC
                    LIMIT 1
                ''', (tuple(cached_urls) if cached_urls else ('',),))
                result = cur.fetchone()
                
                if result:
                    next_profiles_cache.append({
                        'profile_url': result['profile_url'],
                        'priority': 'recheck'
                    })
                    continue

                # 2. Second priority: Uncategorized profiles without recheck date
                cur.execute('''
                    SELECT profile_url 
                    FROM profiles 
                    WHERE category IS NULL
                    AND recheck_date IS NULL
                    AND connection_since IS NOT NULL
                    AND profile_url NOT IN %s
                    ORDER BY connection_since DESC
                    LIMIT 1
                ''', (tuple(cached_urls) if cached_urls else ('',),))
                result = cur.fetchone()
                
                if result:
                    next_profiles_cache.append({
                        'profile_url': result['profile_url'],
                        'priority': 'uncategorized'
                    })
                    continue

                # 3. Third priority: Random network or lead without recheck date
                cur.execute('''
                    SELECT profile_url 
                    FROM profiles 
                    WHERE category IN ('network', 'lead')
                    AND recheck_date IS NULL
                    AND profile_url NOT IN %s
                    ORDER BY RANDOM()
                    LIMIT 1
                ''', (tuple(cached_urls) if cached_urls else ('',),))
                result = cur.fetchone()
                
                if result:
                    next_profiles_cache.append({
                        'profile_url': result['profile_url'],
                        'priority': 'network_lead'
                    })
                    continue

                # If no more profiles match criteria, break the loop
                break
                
            finally:
                cur.close()
                conn.close()

@app.route('/')
def dashboard():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    
    try:
        # Total profiles
        cur.execute('SELECT COUNT(*) FROM profiles')
        total_profiles = cur.fetchone()[0]
        
        # Profiles updated today
        cur.execute('''
            SELECT COUNT(*) 
            FROM profiles 
            WHERE DATE(updated_at) = CURRENT_DATE
        ''')
        worked_today = cur.fetchone()[0]
        
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
        
        # Most recent updates - Changed from 5 to 50
        cur.execute('''
            SELECT profile_url, full_name, updated_at, category
            FROM profiles
            WHERE updated_at IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 50
        ''')
        recent_updates = cur.fetchall()
        
        # Connection timeline - Changed to weekly
        cur.execute('''
            SELECT 
                DATE_TRUNC('week', connection_since) as week,
                COUNT(*) as count
            FROM profiles
            WHERE connection_since IS NOT NULL
            GROUP BY week
            ORDER BY week DESC
            LIMIT 12  -- Last 12 weeks
        ''')
        timeline_data = cur.fetchall()
        
        # Format the timeline data
        connection_timeline = [
            {
                'week': row['week'].strftime('%Y-%m-%d'),  # Start of week
                'count': row['count']
            }
            for row in timeline_data
        ]
        
        return render_template('dashboard.html',
                             total_profiles=total_profiles,
                             worked_today=worked_today,
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
    
    if file.filename == '' or not file.filename.endswith('.csv'):
        print("Invalid file format")
        return jsonify({'error': 'Invalid file. Must be a CSV'}), 400

    try:
        print("Reading file contents")
        content = file.stream.read().decode("UTF8")
        
        # Skip notes section if present
        if content.startswith('Notes:'):
            print("Skipping notes section")
            content = content[content.find('\n\n') + 2:]
        
        stream = io.StringIO(content, newline=None)
        csv_reader = csv.DictReader(stream)
        
        # Determine CSV format based on headers
        headers = csv_reader.fieldnames
        is_old_format = 'profileUrl' in headers
        print(f"CSV Format: {'old' if is_old_format else 'new'}")
        
        print("Connecting to database")
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("Processing CSV rows")
        for row in csv_reader:
            print(f"Processing row: {upload_progress['processed'] + 1}")
            upload_progress['processed'] += 1
            
            # Map fields based on format
            if is_old_format:
                profile_url = row['profileUrl']
                first_name = row['firstName']
                last_name = row['lastName']
                full_name = row['fullName']
                title = row['title']
                connection_since = row['connectionSince']
                profile_image_url = row['profileImageUrl']
            else:
                profile_url = row['URL']
                first_name = row['First Name']
                last_name = row['Last Name']
                full_name = f"{first_name} {last_name}".strip()
                title = row['Position']
                # Convert date format from "DD MMM YYYY" to ISO format
                try:
                    date_obj = datetime.strptime(row['Connected On'], '%d %b %Y')
                    connection_since = date_obj.strftime('%Y-%m-%d')
                except:
                    connection_since = None
                profile_image_url = None

            # Add "/" to profile_url end if missing
            if not profile_url.endswith('/'):
                profile_url += '/'
            
            # Check if profile exists
            cur.execute('SELECT profile_url FROM profiles WHERE profile_url = %s', (profile_url,))
            if cur.fetchone():
                upload_progress['skipped_records'] += 1
                continue
            
            # Insert new profile
            cur.execute('''
                INSERT INTO profiles 
                (profile_url, first_name, last_name, full_name, title, 
                 connection_since, profile_image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (
                profile_url, first_name, last_name, full_name,
                title, connection_since, profile_image_url
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
            
            # First check if profile exists
            cur.execute('SELECT profile_url FROM profiles WHERE profile_url = %s', (data['profile_url'],))
            profile_exists = cur.fetchone()
            
            if not profile_exists:
                return jsonify({
                    'status': 'error',
                    'message': 'Profile not found in database. Please import profile data first.'
                }), 404
            
            recheck_date = data.get('recheck_date')
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
                recheck_date,
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
            return jsonify({
                'next_profile_url': result['profile_url']
            })

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
            return jsonify({
                'next_profile_url': result['profile_url']
            })

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
            return jsonify({
                'next_profile_url': result['profile_url']
            })

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

@app.route('/process-voice-message', methods=['POST'])
def process_voice_message():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        profile_content = request.form.get('profile_content', '')
        
        # Save the audio file temporarily
        temp_filename = 'temp_audio.mp3'
        audio_file.save(temp_filename)

        # Transcribe using Whisper API
        with open(temp_filename, 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file
            )

        # Clean up temporary file
        os.remove(temp_filename)

        # Refine the transcription with GPT
        prompt = f"""
        Please refine this transcribed message. Format it with appropriate line breaks 
        but no other formatting. Make sure company names and person names match the profile content.
        My name is {MY_NAME}.
        Use this profile content as reference for names and companies: 
        {profile_content}

        Here is the transcribed message:
        {transcript.text}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": transcript.text}
            ],
            temperature=0.7,
            max_tokens=500
        )

        refined_message = response.choices[0].message.content.strip()
        
        return jsonify({
            'status': 'success',
            'message': refined_message
        })
        
    except Exception as e:
        print(f"Error processing voice message: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/profile/<path:profile_url>')
def view_profile(profile_url):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=DictCursor)
    
    try:
        # Get profile data
        cur.execute('''
            SELECT * FROM profiles 
            WHERE profile_url = %s
        ''', (profile_url,))
        profile = cur.fetchone()
        
        if not profile:
            flash('Profile not found', 'error')
            return redirect('/')
            
        return render_template('profile.html', 
                             profile=dict(profile),
                             categories=['lead', 'customer', 'network', 'friend', 'stale'])
                             
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    init_db()  # Initialize database on startup
    app.run(host='0.0.0.0', port=int(os.getenv('APP_PORT', 8000)), debug=True)