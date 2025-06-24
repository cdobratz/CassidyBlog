# Personal Portfolio & Blog

A Flask-based personal portfolio and blog website that showcases projects, shares insights through blog posts, and provides a professional online presence. Built with modern web technologies and designed for easy deployment on Railway.

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
- **Deployment**: Railway Platform
- **Build System**: Nixpacks

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

## Deployment to Railway

### Prerequisites
- GitHub account with your repository
- Railway account (free tier available)

### Deploy Steps

1. **Connect Repository**: 
   - Login to [Railway](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure Settings**:
   - Railway will automatically detect it's a Python project
   - Ensure your `railway.toml` is configured correctly:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "python app.py"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "always"
```

3. **Environment Variables**:
   - Railway automatically sets the `PORT` environment variable
   - Add any additional environment variables in the Railway dashboard

4. **Deploy**:
   - Push changes to your main branch
   - Railway will automatically build and deploy your application
   - Your site will be available at `your-app-name.up.railway.app`

### Custom Domain (Optional)

1. In Railway dashboard, go to your project settings
2. Navigate to "Networking" → "Custom Domain"
3. Add your domain and configure DNS settings

## Project Structure

```
CassidyBlog/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── railway.toml          # Railway deployment config
├── templates/            # HTML templates
├── static/              # CSS, JS, images
├── content/             # Blog content
│   └── posts/           # Markdown blog posts
└── README.md            # This file
```

## Configuration

The application uses the following configuration:
- **Port**: Configurable via `PORT` environment variable (default: 8000)
- **Host**: Bound to `0.0.0.0` for Railway deployment
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

Built with ❤️ using Flask and deployed on Railway.
