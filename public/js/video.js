

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', document.body.dataset.theme);
});

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.dataset.theme = savedTheme;




document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chatBox");
    const messageInput = document.getElementById("messageInput");
    const sendMessageButton = document.getElementById("sendMessage");

    if (!chatBox || !messageInput || !sendMessageButton) {
        console.error("Required chat elements are missing in the DOM");
        return;
    }

    const socket = io();
    socket.on("connect_error", (error) => {
        console.error("Socket.IO connection error:", error);
        const errorElement = document.createElement("div");
        errorElement.classList.add("system-message");
        errorElement.textContent = "Failed to connect to chat server";
        chatBox.appendChild(errorElement);
    });

    const name = document.getElementById("username")?.value || window.name;
    if (!name) {
        console.error("Username not provided");
        return;
    }
    socket.emit("join", name);

    socket.on("receiveMessage", (message) => {
        const messageElement = document.createElement("div");
        const infoElement = document.createElement("div");
        infoElement.classList.add("message-info");
        infoElement.textContent = `${message.sender} - ${message.time}`;
        const textElement = document.createElement("div");
        textElement.textContent = message.text;
        messageElement.appendChild(infoElement);
        messageElement.appendChild(textElement);
        if (message.sender === name) {
            messageElement.classList.add("message-sent");
        } else {
            messageElement.classList.add("message-received");
        }
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    socket.on("userJoined", (user) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("system-message");
        messageElement.textContent = `${user} joined the chat`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    socket.on("userLeft", (user) => {
        const messageElement = document.createElement("div");
        messageElement.classList.add("system-message");
        messageElement.textContent = `${user} left the chat`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            socket.emit("sendMessage", message);
            messageInput.value = "";
        }
    }

    sendMessageButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
});




