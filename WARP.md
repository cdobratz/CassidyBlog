# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Local Development
```bash
# Run the Flask development server
python app.py
```
The app will be available at `http://localhost:8000`.

### Adding New Blog Posts
```bash
# Interactive blog post creator (recommended)
python add_post.py

# Manual creation: Add .md files directly to content/posts/
# Format: Title as H1, then content
```

### Dependencies
```bash
# Install Python dependencies
pip install -r requirements.txt
```

### Deployment
The application is configured for Railway deployment:
```bash
# Production server starts automatically via railway.toml
# Uses: gunicorn --bind 0.0.0.0:$PORT app:app
```

## Architecture Overview

### Application Structure
This is a Flask-based personal portfolio and blog with a markdown-driven content system.

**Core Components:**
- `app.py` - Main Flask application with routing, post parsing, and caching logic
- `add_post.py` - CLI utility for creating new blog posts with proper formatting
- `templates/` - Jinja2 HTML templates for pages (index, blog, projects, about, post)
- `static/` - CSS, JavaScript, and static assets (styles.css, favicon)
- `content/posts/` - Markdown files for blog posts (not version controlled content)

### Blog Post System
**Post Processing Pipeline:**
1. Posts are stored as `.md` files in `content/posts/`
2. `_get_posts_internal()` reads all markdown files and parses metadata
3. `parse_post_content()` extracts title (first H1), date, and summary
4. Posts cached with `@lru_cache` for performance (cleared in debug mode)
5. Manual date mapping in `extract_date_from_content()` for specific posts

**Post Metadata:**
- **Title**: Extracted from first line (must be H1: `# Title`)
- **Slug**: Generated from filename (e.g., `my-post.md` → slug: `my-post`)
- **Date**: Priority: 1) hardcoded mapping in code, 2) extracted from content via regex, 3) file mtime
- **Summary**: Auto-generated from first 2 substantial content lines (max 200 chars)

### Key Design Patterns
- **Caching**: LRU cache on `get_cached_posts()` improves performance; cache cleared in debug mode
- **Date Management**: Posts use manual date mapping in `app.py` (lines 68-76) for chronological ordering
- **Slug-based URLs**: Blog posts accessed via `/blog/<slug>` where slug = filename without `.md`
- **Title Deduplication**: Post rendering strips H1 from markdown to avoid duplicate titles in template

### Routes
- `/` - Home page with recent posts
- `/blog` - Blog listing page
- `/blog/<slug>` - Individual blog post
- `/blog/new` - Create new post via web form (POST)
- `/projects` - Portfolio projects showcase
- `/about` - About page
- `/contact` - Contact form (POST, no email logic implemented)

### Critical Implementation Details
**When adding new posts:**
- Use `add_post.py` for consistency (handles slug generation, date formatting)
- Posts require `# Title` as first line
- **Important**: Ensure no `^D` character appears at the end of the post content
- To control post ordering, update `date_mapping` dict in `app.py` (lines 68-76)
- **Must restart Flask app** after adding a post for it to appear (cache must be cleared)

**When modifying post parsing:**
- Post parsing logic is in `parse_post_content()` and helper functions
- Date extraction has 3 fallback levels (see `extract_date_from_content()`)
- Summary generation skips title and author lines (see `create_summary()`)

### Configuration
- **Port**: Configurable via `PORT` environment variable (default: 8000)
- **Host**: Bound to `0.0.0.0` for Railway deployment compatibility
- **Debug Mode**: Set to `False` in production (line 214)
- **Posts Directory**: Hardcoded as `content/posts/` relative to app root

### Deployment Notes
- Railway uses Nixpacks builder
- Production uses Gunicorn WSGI server
- Health check on `/` route
- No database - all content is file-based markdown
