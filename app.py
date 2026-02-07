from flask import Flask, render_template, request, redirect, url_for
import markdown
import os
from datetime import datetime
import glob
import re
from functools import lru_cache

app = Flask(__name__)

# Blog posts directory
POSTS_DIR = os.path.join(os.path.dirname(__file__), 'content', 'posts')
# Force redeploy to ensure new blog post appears

@lru_cache(maxsize=32)
def get_cached_posts():
    """Cached version of get_posts for better performance"""
    return _get_posts_internal()

def _get_posts_internal():
    """Internal function to read and parse blog posts"""
    posts = []
    for file in glob.glob(os.path.join(POSTS_DIR, '*.md')):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read()
                post_data = parse_post_content(content, file)
                if post_data:
                    posts.append(post_data)
        except Exception as e:
            print(f"Error reading {file}: {e}")
            continue
    
    # Sort by custom date first, then by filename as fallback
    return sorted(posts, key=lambda x: (x['date_obj'], x['slug']), reverse=True)

def parse_post_content(content, file_path):
    """Parse markdown content and extract metadata"""
    lines = content.split('\n')
    if not lines:
        return None
    
    # Extract title from first line
    title = lines[0].replace('#', '').strip() if lines[0].startswith('#') else 'Untitled'
    
    # Get slug from filename
    slug = os.path.basename(file_path).replace('.md', '')
    
    # Parse date from content or use predefined mapping
    date_obj, date_str = extract_date_from_content(content, slug)
    
    # Create summary from content (skip title and potential date line)
    summary = create_summary(lines)
    
    return {
        'title': title,
        'content': content,
        'slug': slug,
        'date_obj': date_obj,
        'date_str': date_str,
        'summary': summary,
        'timestamp': os.path.getmtime(file_path)  # Keep for compatibility
    }

def extract_date_from_content(content, slug):
    """Extract or assign publication date"""
    # Manual date mapping for existing posts (newest first)
    date_mapping = {
        'nfl_sentiment_blog_post': ('2025-01-29', 'January 29, 2025'),  # Make this the newest
        'healthcare_big_data_blog': ('2025-01-15', 'January 15, 2025'),
        'insurance_data_mining_blog': ('2025-01-10', 'January 10, 2025'),
        'banking_data_mining_blog': ('2025-01-05', 'January 5, 2025'),
        'database_security_blog': ('2024-12-20', 'December 20, 2024'),
        'dashboard_comparison_blog': ('2024-12-15', 'December 15, 2024'),
        'doj_google_blog_post': ('2024-12-10', 'December 10, 2024'),
    }
    
    if slug in date_mapping:
        date_str, display_date = date_mapping[slug]
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            return date_obj, display_date
        except ValueError:
            pass
    
    # Try to extract date from content using regex
    date_pattern = r'\*([A-Za-z]+ \d{1,2}, \d{4})'
    match = re.search(date_pattern, content)
    if match:
        try:
            date_str = match.group(1)
            date_obj = datetime.strptime(date_str, '%B %d, %Y')
            return date_obj, date_str
        except ValueError:
            pass
    
    # Fallback to file modification time
    return datetime(2024, 1, 1), 'January 1, 2024'

def create_summary(lines):
    """Create a clean summary from content lines"""
    # Skip title (line 0) and potential date/author line
    start_idx = 1
    if len(lines) > 1 and ('*' in lines[1] or lines[1].strip() == ''):
        start_idx = 2
    
    # Find content lines (skip empty lines)
    content_lines = []
    for i in range(start_idx, min(len(lines), start_idx + 5)):
        line = lines[i].strip()
        if line and not line.startswith('#'):
            content_lines.append(line)
        if len(content_lines) >= 2:  # Get 2 substantial lines
            break
    
    summary = ' '.join(content_lines)
    # Clean up markdown formatting
    summary = re.sub(r'[#*>]', '', summary)
    summary = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', summary)  # Remove links
    summary = summary.strip()
    return summary[:200] + '...' if len(summary) > 200 else summary

def get_posts():
    """Get all blog posts with caching"""
    # Clear cache in development/debug mode
    if app.debug:
        get_cached_posts.cache_clear()
    return get_cached_posts()


def get_post_by_slug(slug):
    """Find a specific post by its slug (filename without extension)"""
    for file in glob.glob(os.path.join(POSTS_DIR, '*.md')):
        if os.path.basename(file).replace('.md', '') == slug:
            with open(file, 'r') as f:
                content = f.read()
                title = content.split('\n')[0].replace('#', '').strip()
                return {
                    'title': title,
                    'content': content,
                    'slug': slug
                }
    return None

@app.route('/')
def index():
    posts = get_posts()
    return render_template('index.html', posts=posts)

@app.route('/projects')
def projects():
    return render_template('projects.html')

@app.route('/blog')
def blog():
    posts = get_posts()
    return render_template('blog.html', posts=posts)

@app.route('/blog/<slug>')
def post(slug):
    post = get_post_by_slug(slug)
    if post:
        # Remove the first line (title) from markdown content to avoid duplication
        content_lines = post['content'].split('\n')
        # Skip the first line if it's a heading (starts with #)
        if content_lines and content_lines[0].startswith('#'):
            content_without_title = '\n'.join(content_lines[1:])
        else:
            content_without_title = post['content']
        
        html_content = markdown.markdown(content_without_title, extensions=['fenced_code'])
        return render_template('post.html', post=post, html_content=html_content)
    else:
        return "Post not found", 404

@app.route('/blog/new', methods=['GET', 'POST'])
def new_post():
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        
        # Create a slug from the title
        slug = title.lower().replace(' ', '-').replace(':', '').replace('?', '').replace('!', '')
        # Remove other special characters
        slug = ''.join(c for c in slug if c.isalnum() or c == '-')
        
        # Create the full markdown content with title header
        full_content = f"# {title}\n\n*{datetime.now().strftime('%B %d, %Y')} | By Cassidy Dobratz*\n\n{content}"
        
        # Save to file
        filename = os.path.join(POSTS_DIR, f"{slug}.md")
        with open(filename, 'w') as f:
            f.write(full_content)
        
        return redirect(url_for('blog'))
    return render_template('new_post.html')

@app.route('/contact', methods=['GET', 'POST'])
def submit_contact():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        message = request.form.get('message')
        # TODO: Add your email sending logic here
        return redirect(url_for('index'))
    return redirect(url_for('index'))

@app.route('/about')
def about():
    return render_template('about.html')
if __name__ == '__main__':
    # Get port from environment variable or default to 5000
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False)
