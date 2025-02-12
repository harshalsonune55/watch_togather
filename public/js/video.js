

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', document.body.dataset.theme);
});

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.dataset.theme = savedTheme;




document.addEventListener("DOMContentLoaded", function () {
    const socket = io();

    const chatBox = document.getElementById("chatBox");
    const messageInput = document.getElementById("messageInput");
    const sendMessageButton = document.getElementById("sendMessage");

    // Join the chat
    socket.emit("join", name);

    // Receive messages
    socket.on("receiveMessage", (message) => {
        const messageElement = document.createElement("div");
        if (message.sender === name) {
            messageElement.classList.add("message-sent");
            messageElement.innerHTML = `
                <div class="message-info">You - ${message.time}</div>
                ${message.text}
            `;
        } else {
            messageElement.classList.add("message-received");
            messageElement.innerHTML = `
                <div class="message-info">${message.sender} - ${message.time}</div>
                ${message.text}
            `;
        }
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // User joined
    socket.on("userJoined", (name) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("system-message");
        messageElement.textContent = `${name} joined the chat`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // User left
    socket.on("userLeft", (name) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("system-message");
        messageElement.textContent = `${name} left the chat`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // Send message
    sendMessageButton.addEventListener("click", () => {
        const message = messageInput.value.trim();
        if (message) {
            socket.emit("sendMessage", message);
            messageInput.value = "";
        }
    });

    // Send message on Enter key
    messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const message = messageInput.value.trim();
            if (message) {
                socket.emit("sendMessage", message);
                messageInput.value = "";
            }
        }
    });
});