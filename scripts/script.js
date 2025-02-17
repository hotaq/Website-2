// Add this to your script.js if you want to dynamically load the icons
function loadSocialIcons() {
    const githubIcon = document.querySelector('img[alt="GitHub"]');
    const linkedinIcon = document.querySelector('img[alt="LinkedIn"]');
    
    // Base64 encoded icons (you can replace these with your own)
    githubIcon.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34...';
    linkedinIcon.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34...';
}

// Call this when the document loads
document.addEventListener('DOMContentLoaded', loadSocialIcons); 