#!/usr/bin/env python3
"""
Simple script to create new blog posts for CassidyBlog
Usage: python add_post.py
"""

import os
from datetime import datetime

def create_slug(title):
    """Convert title to URL-friendly slug"""
    slug = title.lower()
    # Replace spaces with hyphens
    slug = slug.replace(' ', '-')
    # Remove common punctuation
    slug = slug.replace(':', '').replace('?', '').replace('!', '').replace(',', '')
    slug = slug.replace('(', '').replace(')', '').replace("'", "").replace('"', '')
    # Keep only alphanumeric characters and hyphens
    slug = ''.join(c for c in slug if c.isalnum() or c == '-')
    # Remove multiple consecutive hyphens
    while '--' in slug:
        slug = slug.replace('--', '-')
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug

def main():
    # Get posts directory
    posts_dir = os.path.join(os.path.dirname(__file__), 'content', 'posts')
    
    print("=== CassidyBlog Post Creator ===\n")
    
    # Get title
    title = input("Enter article title: ").strip()
    if not title:
        print("Title cannot be empty!")
        return
    
    # Create slug
    slug = create_slug(title)
    filename = f"{slug}.md"
    filepath = os.path.join(posts_dir, filename)
    
    # Check if file already exists
    if os.path.exists(filepath):
        overwrite = input(f"File '{filename}' already exists. Overwrite? (y/N): ").strip().lower()
        if overwrite != 'y':
            print("Cancelled.")
            return
    
    # Get content
    print(f"\nCreating post: {title}")
    print(f"Filename: {filename}")
    print("\nEnter your article content (Markdown supported).")
    print("Press Ctrl+D (Mac/Linux) or Ctrl+Z+Enter (Windows) when finished:\n")
    
    content_lines = []
    try:
        while True:
            line = input()
            content_lines.append(line)
    except EOFError:
        pass
    
    content = '\n'.join(content_lines).strip()
    
    if not content:
        print("\nNo content provided. Cancelled.")
        return
    
    # Create the full markdown content
    date_str = datetime.now().strftime('%B %d, %Y')
    full_content = f"""# {title}

*{date_str} | By Cassidy Dobratz*

{content}
"""
    
    # Write to file
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(full_content)
        print(f"\n✅ Successfully created: {filepath}")
        print(f"📝 Article title: {title}")
        print(f"🔗 URL slug: {slug}")
        print(f"\nYour post is ready! Restart your Flask app to see it live.")
    except Exception as e:
        print(f"\n❌ Error creating post: {e}")

if __name__ == "__main__":
    main()
