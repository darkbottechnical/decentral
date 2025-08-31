// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const dgram = require("dgram");

const { listIPv4Interfaces, ipToInt, intToIp } = require("./src/ip-helpers.js");

let mainWindow;
let udpSocket;
let statusInterval;
let displayName;
let selfStatus = "online";

const PORT = 4123;

function sendBroadcastMessage() {
    if (!udpSocket) {
        console.error("UDP socket is not available");
        mainWindow?.webContents.send("debug", {
            message: "UDP socket is not available",
        });
        clearInterval(statusInterval);
        return;
    }
    const statusPacket = {
        type: "status",
        source: {
            ip: udpSocket.localIdentity?.ip || "unknown",
            name: displayName || "unknown",
            mac: udpSocket.localIdentity?.mac || "unknown",
        },
        status: selfStatus,
    };
    const buf = Buffer.from(JSON.stringify(statusPacket));
    udpSocket.send(buf, 0, buf.length, PORT, udpSocket.broadcastAddr, (err) => {
        if (err) {
            console.error("Status send error:", err);
            mainWindow?.webContents.send("debug", {
                message: `Status send error: ${err.message}`,
            });
        }
    });
}

function whoIsOn() {
    if (!udpSocket) return;
    const packet = {
        type: "who-is-on",
        source: {
            ip: udpSocket.localIdentity?.ip || "unknown",
            name: displayName || "unknown",
            mac: udpSocket.localIdentity?.mac || "unknown",
        },
    };
    const buf = Buffer.from(JSON.stringify(packet));
    udpSocket.send(buf, 0, buf.length, PORT, udpSocket.broadcastAddr, (err) => {
        if (err) console.error("Who-is-on send error:", err);
    });
}

// ---- UDP Setup ----
function setupUDP(localIp, netmask, ifaceName = "unknown", mac = "unknown") {
    if (udpSocket) udpSocket.close();
    if (statusInterval) clearInterval(statusInterval);
    udpSocket = dgram.createSocket("udp4");

    const ipInt = ipToInt(localIp);
    const maskInt = ipToInt(netmask);
    const broadcastInt = (ipInt & maskInt) | (~maskInt >>> 0);
    const BROADCAST_ADDR = intToIp(broadcastInt);

    udpSocket.on("message", (msg, rinfo) => {
        setImmediate(() => {
            try {
                const parsed = JSON.parse(msg.toString());
                if (parsed.type === "message") {
                    mainWindow?.webContents.send("udp-message", parsed);
                } else if (parsed.type === "status") {
                    mainWindow?.webContents.send("status-change", parsed);
                } else if (parsed.type === "who-is-on") {
                    sendBroadcastMessage();
                }
            } catch {
                mainWindow?.webContents.send("udp-message", {
                    source: {
                        ip: rinfo.address,
                        name: "unknown",
                        mac: "unknown",
                    },
                    message: msg.toString(),
                });
            }
        });
    });

    udpSocket.bind(PORT, localIp, () => {
        console.log(`UDP socket successfully bound to ${localIp}:${PORT}`);
        udpSocket.setBroadcast(true);
        if (mainWindow) {
            mainWindow.webContents.send("debug", {
                message: `Bound UDP socket to ${localIp}:${PORT} (broadcast ${BROADCAST_ADDR})`,
            });
            if (statusInterval) clearInterval(statusInterval);
            sendBroadcastMessage();
            statusInterval = setInterval(sendBroadcastMessage, 10000);
        } else {
            console.error("mainWindow is not available during bind");
        }
    });
    udpSocket.broadcastAddr = BROADCAST_ADDR;
    udpSocket.localIdentity = { ip: localIp, name: ifaceName, mac };
}

function sendMessage(message, name, to = null) {
    if (!udpSocket) return;
    const packet = {
        type: "message",
        source: {
            ip: udpSocket.localIdentity?.ip || "unknown",
            name: name || udpSocket.localIdentity?.name || "unknown",
            mac: udpSocket.localIdentity?.mac || "unknown",
        },
        message,
    };
    console.log(packet);
    const buf = Buffer.from(JSON.stringify(packet));
    udpSocket.send(buf, 0, buf.length, PORT, udpSocket.broadcastAddr, (err) => {
        if (err) console.error("Send error:", err);
    });
}

// ---- IPC ----
ipcMain.on(
    "choose-interface",
    (event, { address, netmask, name, mac, displayName: dName }) => {
        displayName = dName || name;
        setupUDP(address, netmask, displayName, mac);
    }
);
ipcMain.on("send-udp-message", (event, msg, name) => {
    sendMessage(msg, name);
});
ipcMain.on("set-display-name", (event, name) => {
    if (udpSocket && udpSocket.localIdentity) {
        displayName = name;
        sendBroadcastMessage();
    }
});
ipcMain.on("set-status", (event, status) => {
    selfStatus = status;
    sendBroadcastMessage();
});

// ---- Electron Window ----
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1250,
        height: 750,
        webPreferences: {
            preload: path.join(__dirname, "src/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile("index.html");

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.webContents.on("did-finish-load", () => {
        const interfaces = listIPv4Interfaces();
        mainWindow.webContents.send("interfaces-list", interfaces);
    });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
    selfStatus = "offline";
    sendBroadcastMessage();
});
app.on("activate", () => {
    if (!mainWindow) createWindow();
});
