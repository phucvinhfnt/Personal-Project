# 🌐 Portfolio & Timeline

A modern, interactive portfolio website with a beautiful animated timeline showcasing projects and achievements. Features a liquid glass header, dark mode toggle, and smooth scroll interactions.

## ✨ Features

- **Animated Timeline** - Interactive vertical timeline with smooth scroll detection
- **Dark Mode** - Theme toggle between light and dark modes with persistent styling
- **Liquid Glass Header** - Modern frosted glass effect with dynamic mouse tracking
- **Smooth Animations** - Glow effects, scaling dots, and card hover interactions
- **Responsive Design** - Fully mobile-friendly with adaptive layouts
- **Apple Font Stack** - Native system fonts for optimal performance

## 📁 Project Structure

```
Personal-Project/
├── index.html      # HTML structure and content
├── style.css       # All styling and theming
├── script.js       # Interactive features and animations
└── README.md       # This file
```

## 🚀 Quick Start

### Local Development

1. Open `index.html` directly in your browser, or
2. Start a local HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (if installed)
npx http-server
```

Then open `http://localhost:8000` in your browser.

### Deploy with Ngrok (Remote Access)

Share your website publicly using ngrok:

```bash
# Install ngrok
pip install pyngrok

# Set your ngrok token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

Create a Python script to run:

```python
from pyngrok import ngrok
import http.server
import socketserver
import threading

PORT = 8001

def run_server():
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(('', PORT), handler) as httpd:
        httpd.serve_forever()

thread = threading.Thread(target=run_server)
thread.start()

public_url = ngrok.connect(PORT)
print(f"🌍 Public URL: {public_url}")
```

## 🎨 Features Breakdown

### Timeline
- **Vertical line** with colored dots representing each project
- **Dot highlighting** - Yellow when active, red on hover
- **Glow animation** - Active cards pulse with a red glow effect
- **Responsive dots** - Adjust size based on screen size

### Theme Toggle
- **Light Mode** - Clean white and gray palette
- **Dark Mode** - Deep background with light text
- **Toggle Button** - Located in the top-right navigation with emoji indicators (☀️/🌙)

### Navigation
- **Sticky Header** - Fixed position with liquid glass effect
- **Anchor Links** - Smooth scrolling to sections (Projects, News, Contact)
- **Status Indicator** - Green dot showing online status

## 🛠 Technologies

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables, gradients, and animations
- **JavaScript (Vanilla)** - No dependencies required
- **Intersection Observer API** - For scroll-based animations

## 📝 Customization

### Edit Projects
Open `script.js` and modify the `projects` array:

```javascript
const projects = [
  {
    date: "2024",
    title: "Your Project",
    desc: "Description of what you did",
    tools: "Tech · Used · Here"
  },
  // Add more projects...
];
```

### Change Colors
Edit CSS variables in `style.css`:

```css
:root {
  --dot-default: #F0B429;        /* Dot color */
  --dot-active-hover: #ff4141;   /* Hover color */
  --text-light: #111827;         /* Text color */
  /* ... more variables */
}
```

### Update Contact Info
Edit the contact section in `index.html`:

```html
<p>You can reach me via email at 
  <a href="mailto:your-email@example.com">your-email@example.com</a>
</p>
```

## 📱 Browser Support

- Chrome/Edge (Latest)
- Firefox (Latest)
- Safari (Latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 License

This project is open source and available under the MIT License.

## 👤 Author

**Vinh Ho** - Portfolio & Timeline Project

---

**Ready to showcase your work?** Customize the content and share your portfolio with the world! 🚀