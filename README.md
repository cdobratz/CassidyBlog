# Personal Portfolio & Blog

A Flask-based personal portfolio and blog website that showcases projects, shares insights through blog posts, and provides a professional online presence. Built with modern web technologies and designed for deployment on Render.

## Features

- **Portfolio Showcase**: Display your projects with descriptions and links
- **Dynamic Blog**: Markdown-based blog posts with automatic parsing
- **Responsive Design**: Mobile-friendly interface that works across all devices
- **Contact Form**: Integrated contact functionality for visitor inquiries
- **Clean UI**: Professional, minimalist design focused on content

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **Content**: Markdown for blog posts
- **Deployment**: Render (free web service)
- **Server**: Gunicorn, bound to `0.0.0.0:$PORT`

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/cdobratz/CassidyBlog.git
cd CassidyBlog
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create content directory and add blog posts:
```bash
mkdir -p content/posts
# Add your .md files to content/posts/
```

4. Run the application:
```bash
python app.py
```

Visit `http://localhost:8000` to view your site.

### Adding Blog Posts

Create markdown files in the `content/posts/` directory. Each post should start with a title as an H1 heading:

```markdown
# Your Post Title

Your post content here...
```

## Deployment to Render

This site is a Flask web service. Pages and markdown posts are rendered on each request, and `/blog/new` accepts authenticated writes. Posts live in `content/posts` as markdown files. The running app never opens a database, so the Blueprint defines only the web service.

The Blueprint is `render.yaml`: a free Python web service named `cassidy-blog`.

- **Build**: `pip install -r requirements.txt`
- **Start**: `gunicorn --bind 0.0.0.0:$PORT app:app`
- **Health check**: `GET /health` (returns `200` and `ok`)
- **Plan**: free (the service spins down after about 15 minutes without traffic)

### Prerequisites

- A Render account
- This GitHub repository

### Deploy with the Blueprint

1. Open the Blueprint dashboard link:

   https://dashboard.render.com/blueprint/new?repo=https://github.com/cdobratz/CassidyBlog

2. Connect GitHub and authorize Render to read the repository if prompted.
3. Review the `cassidy-blog` web service. The Blueprint defines that service alone.
4. Set the environment variables below. Render asks for them because they are declared with `sync: false`. Enter the values in the Dashboard only.
5. Click **Apply** and wait until the deploy is live.
6. Open the service URL Render assigns (typically `https://cassidy-blog.onrender.com`) and confirm `/` and `/health` respond.

`PORT` is set by Render. Gunicorn listens on `0.0.0.0:$PORT`.

### Environment variables

| Name | Required | Purpose |
|------|----------|---------|
| `SECRET_KEY` | Yes | Flask session and CSRF signing key. Use a long random value. Without it, each process invents its own key and sessions do not survive a restart. |
| `ADMIN_USER` | No | HTTP Basic Auth username for `/blog/new`. Defaults to `admin` when unset. |
| `ADMIN_PASSWORD` | Yes, to publish from the browser | Password for `/blog/new`. When unset, that route stays locked. |
| `PORT` | Set by Render | Listen port. Leave this to the platform. |

### Posts and the filesystem

Blog posts that are committed under `content/posts/` ship with every deploy. The Render filesystem is ephemeral: a post created through `/blog/new` disappears on the next restart or deploy. Add posts by committing markdown files (or `python add_post.py` locally, then commit).

### Move a custom domain

Posts already link to `https://cassidydobratz.com`. Custom domains on a web service require a paid instance type. In the service **Settings**, change the plan from **Free** to **Starter** (or above) before adding the hostname.

After the plan change:

1. In the Render Dashboard, open the `cassidy-blog` service → **Settings** → **Custom Domains**.
2. Add `cassidydobratz.com`. Render also adds `www.cassidydobratz.com` and a redirect between the apex and `www`.
3. Copy the service hostname shown in the Dashboard. It is `cassidy-blog.onrender.com` unless that name was already taken.
4. At your DNS provider, remove the Railway records for this domain:
   - CNAME targets ending in `up.railway.app`
   - A records that pointed at Railway
   - AAAA (IPv6) records on the apex and `www`
5. Add Render records. Use a short TTL (300 seconds) during the cutover.

   | Host | Type | Value |
   |------|------|-------|
   | `www` | CNAME | `<service>.onrender.com` |
   | `@` (apex) on Cloudflare | CNAME (flattened), DNS-only until verified | `<service>.onrender.com` |
   | `@` (apex) on Namecheap | ALIAS | `<service>.onrender.com` |
   | `@` (apex) elsewhere | A | IPv4 address shown in the Render custom-domain panel |

6. If the zone publishes CAA records, allow certificate issuance:

   ```
   cassidydobratz.com. IN CAA 0 issue "letsencrypt.org"
   cassidydobratz.com. IN CAA 0 issuewild "letsencrypt.org"
   cassidydobratz.com. IN CAA 0 issue "pki.goog; cansignhttpexchanges=yes"
   cassidydobratz.com. IN CAA 0 issuewild "pki.goog; cansignhttpexchanges=yes"
   ```

7. Click **Verify** in Render. Certificate issuance starts after DNS is visible. Wait a few minutes and retry if verification fails.
8. After `https://cassidydobratz.com` serves the Render deploy, delete the custom domain from the Railway service so the old target is not left in place.

Render terminates TLS at the edge and renews the certificate. The app keeps speaking HTTP on `PORT`.

## Project Structure

```
CassidyBlog/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── render.yaml           # Render Blueprint (free web service)
├── templates/            # HTML templates
├── static/              # CSS, JS, images
├── content/             # Blog content
│   └── posts/           # Markdown blog posts
└── README.md            # This file
```

## Configuration

The application uses the following configuration:
- **Port**: Render sets `PORT`. Local `python app.py` defaults to `8000`.
- **Host**: Bound to `0.0.0.0` so Render's proxy can reach the process
- **Health check**: `GET /health`
- **Debug**: Disabled in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Contact

- **Email**: cdobratz@me.me
- **Twitter**: [@cdobratz](https://twitter.com/cdobratz)
- **GitHub**: [cdobratz](https://github.com/cdobratz)

---

Built with ❤️ using Flask and deployed on Render.
