const loginForm = document.getElementById("login");
const registerForm = document.getElementById("register");
const btnSlider = document.getElementById("btn");
const loginBtn = document.querySelector('.toggle-btn:nth-child(2)');
const registerBtn = document.querySelector('.toggle-btn:nth-child(3)');

function register() {
    loginForm.classList.add('hidden');
    registerForm.classList.add('active');
    btnSlider.style.left = "110px";
    loginBtn.classList.remove('active');
    registerBtn.classList.add('active');
}

function login() {
    loginForm.classList.remove('hidden');
    registerForm.classList.remove('active');
    btnSlider.style.left = "4px";
    loginBtn.classList.add('active');
    registerBtn.classList.remove('active');
}

// Initialize the forms
login(); // Set initial state

// Form submission handlers
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = loginForm.querySelector('input[type="text"]').value.trim();
    const password = loginForm.querySelector('input[type="password"]').value.trim();
    
    // Basic validation
    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        console.log('Attempting login with:', { username });
        
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Login response:', data);

        if (response.ok) {
            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            // Redirect to lobby page
            window.location.href = '/lobby.html';
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error connecting to the server. Please try again.');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = registerForm.querySelector('input[type="text"]').value;
    const email = registerForm.querySelector('input[type="email"]').value;
    const password = registerForm.querySelector('input[type="password"]').value;
    const confirmPassword = registerForm.querySelectorAll('input[type="password"]')[1].value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Registration successful!');
            login(); // Switch to login form
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Error registering user');
    }
}); 