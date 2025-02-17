let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = '/index.html';
        return;
    }

    // Initialize user info
    document.getElementById('displayUsername').textContent = currentUser.username;
    document.getElementById('displayEmail').textContent = currentUser.email;
    document.getElementById('userInitials').textContent = getInitials(currentUser.username);
    
    // Pre-fill email field
    document.getElementById('email').value = currentUser.email;
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const newUsername = formData.get('newUsername');
    const email = formData.get('email');
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    // Validate passwords match
    if (newPassword && newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    // Validate current password is provided if changing password
    if (newPassword && !currentPassword) {
        alert('Please enter your current password to change password');
        return;
    }

    try {
        const response = await fetch('/api/users/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: currentUser.username,
                newUsername: newUsername || undefined,
                email: email || undefined,
                currentPassword: currentPassword || undefined,
                newPassword: newPassword || undefined
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message);
        }

        // Update local storage
        localStorage.setItem('user', JSON.stringify(data.user));
        
        alert('Settings updated successfully');
        window.location.href = '/lobby.html';
    } catch (error) {
        alert(error.message);
    }
});

function getInitials(username) {
    return username
        .split(/[\s_-]/)
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
} 