const { app, BrowserWindow, ipcMain } = require("electron");
const dgram = require("dgram");
const path = require("path");

let mainWindow;
const udpSocket = dgram.createSocket("udp4");

const PORT = 4123;
const BROADCAST_ADDR = "255.255.255.255";

// Setup UDP listener
udpSocket.bind(PORT, () => {
    console.log(`Listening for UDP messages on port ${PORT}`);
    udpSocket.setBroadcast(true);
});

udpSocket.on("message", (msg, rinfo) => {
    console.log(`Received message: ${msg} from ${rinfo.address}:${rinfo.port}`);
    // Forward UDP message to renderer
    if (mainWindow) {
        mainWindow.webContents.send("udp-message", {
            message: msg.toString(),
            from: `${rinfo.address}:${rinfo.port}`,
        });
    }
});

// Function to send a message
function sendMessage(message) {
    const messageBuffer = Buffer.from(message);
    udpSocket.send(
        messageBuffer,
        0,
        messageBuffer.length,
        PORT,
        BROADCAST_ADDR,
        (err) => {
            if (err) {
                console.error("Error sending message:", err);
            } else {
                console.log("Message sent:", message);
            }
        }
    );
}

// IPC handler so renderer can send messages
ipcMain.on("send-udp-message", (event, msg) => {
    sendMessage(msg);
});

// Window creation
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"), // safer than nodeIntegration
        },
    });

    mainWindow.loadFile("index.html");

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (mainWindow === null) createWindow();
});
