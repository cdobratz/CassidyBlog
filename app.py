from flask import Flask, render_template, request, redirect, url_for
import markdown
import os
from datetime import datetime
import glob

app = Flask(__name__)

# Blog posts directory
POSTS_DIR = os.path.join(os.path.dirname(__file__), 'content', 'posts')
# Force redeploy to ensure new blog post appears

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
