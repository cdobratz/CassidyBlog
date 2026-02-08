from flask import Flask, render_template, request, redirect, url_for, Response
import markdown
import os
import secrets
from datetime import datetime
import glob
from functools import wraps
from flask_talisman import Talisman
from flask_wtf.csrf import CSRFProtect
import bleach

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Security headers via Talisman
csp = {
    'default-src': "'self'",
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src': "'self' https://fonts.gstatic.com",
    'img-src': "'self' data:",
    'connect-src': "'self'",
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
}

Talisman(
    app,
    force_https=False,
    strict_transport_security=True,
    strict_transport_security_max_age=31536000,
    strict_transport_security_include_subdomains=True,
    content_security_policy=csp,
    referrer_policy='strict-origin-when-cross-origin',
    permissions_policy={
        'geolocation': '()',
        'microphone': '()',
        'camera': '()',
        'payment': '()',
    },
)

# CSRF protection
csrf = CSRFProtect(app)

# Bleach allowlist for sanitizing rendered markdown
ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'u', 's', 'del',
    'pre', 'code',
    'ul', 'ol', 'li',
    'blockquote',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
    'sup', 'sub',
    'div', 'span',
]

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'rel'],
    'img': ['src', 'alt', 'title'],
    'code': ['class'],
    'pre': ['class'],
    'div': ['class'],
    'span': ['class'],
    'td': ['align'],
    'th': ['align'],
}

# HTTP Basic Auth for protected routes
def check_auth(username, password):
    admin_user = os.environ.get('ADMIN_USER', 'admin')
    admin_pass = os.environ.get('ADMIN_PASSWORD')
    if not admin_pass:
        return False
    return username == admin_user and password == admin_pass

def requires_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return Response(
                'Authentication required.', 401,
                {'WWW-Authenticate': 'Basic realm="Login Required"'}
            )
        return f(*args, **kwargs)
    return decorated

@app.after_request
def set_extra_security_headers(response):
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

# Blog posts directory
POSTS_DIR = os.path.join(os.path.dirname(__file__), 'content', 'posts')

def get_posts():
    """Read all markdown files from the posts directory and provide a clean summary for each post."""
    posts = []
    for file in glob.glob(os.path.join(POSTS_DIR, '*.md')):
        with open(file, 'r') as f:
            content = f.read()
            lines = content.split('\n')
            # Extract title from first line (assuming it's a markdown heading)
            title = lines[0].replace('#', '').strip() if lines else ''
            # Get the filename without extension for the URL
            slug = os.path.basename(file).replace('.md', '')
            # Get modification time
            timestamp = os.path.getmtime(file)
            # Create a summary: skip title and date/author, join next 2-3 lines or up to 200 chars
            summary_lines = lines[2:5] if len(lines) > 2 else []
            summary = ' '.join(summary_lines)
            # Remove common markdown formatting
            summary = summary.replace('#', '').replace('*', '').replace('>', '').strip()
            summary = summary[:200]
            posts.append({
                'title': title,
                'content': content,
                'slug': slug,
                'timestamp': timestamp,
                'summary': summary
            })
    # Sort posts by modification time (newest first)
    return sorted(posts, key=lambda x: x['timestamp'], reverse=True)


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
        
        html_content = markdown.markdown(content_without_title)
        html_content = bleach.clean(
            html_content,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            strip=True,
        )
        return render_template('post.html', post=post, html_content=html_content)
    else:
        return "Post not found", 404

@app.route('/blog/new', methods=['GET', 'POST'])
@requires_auth
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
