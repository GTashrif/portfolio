// Toggle between light and dark theme
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const btn = document.querySelector('.theme-toggle');
    
    html.setAttribute('data-theme', newTheme);
    btn.textContent = newTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    
    localStorage.setItem('theme', newTheme);
}

// Toggle mobile menu
function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('active');
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            // Close mobile menu if open
            document.getElementById('navLinks').classList.remove('active');
        }
    });
});

// Load saved theme on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const btn = document.querySelector('.theme-toggle');
    document.documentElement.setAttribute('data-theme', savedTheme);
    btn.textContent = savedTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
});