// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const dgram = require("dgram");

const { listIPv4Interfaces, ipToInt, intToIp } = require("./src/ip-helpers.js");

let mainWindow;
let udpSocket;

const PORT = 4123;
const STATUSPORT = 4124;

// ---- UDP Setup ----
function setupUDP(localIp, netmask, ifaceName = "unknown", mac = "unknown") {
    if (udpSocket) udpSocket.close();
    udpSocket = dgram.createSocket("udp4");

    const ipInt = ipToInt(localIp);
    const maskInt = ipToInt(netmask);
    const broadcastInt = (ipInt & maskInt) | (~maskInt >>> 0);
    const BROADCAST_ADDR = intToIp(broadcastInt);

    udpSocket.on("message", (msg, rinfo) => {
        setImmediate(() => {
            try {
                const parsed = JSON.parse(msg.toString());
                if (mainWindow) {
                    mainWindow.webContents.send("udp-message", parsed);
                }
            } catch {
                if (mainWindow) {
                    mainWindow.webContents.send("udp-message", {
                        source: {
                            ip: rinfo.address,
                            name: "unknown",
                            mac: "unknown",
                        },
                        message: msg.toString(),
                    });
                }
            }
        });
    });

    udpSocket.bind(PORT, localIp, () => {
        udpSocket.setBroadcast(true);
        if (mainWindow) {
            mainWindow.webContents.send("debug", {
                message: `Bound UDP socket to ${localIp}:${PORT} (broadcast ${BROADCAST_ADDR})`,
            });
        }
    });

    udpSocket.bind(STATUSPORT, localIp, () => {
        udpSocket.setBroadcast(true);
        if (mainWindow) {
            mainWindow.webContents.send("debug", {
                message: `Bound STATUS UDP socket to ${localIp}:${STATUSPORT} (broadcast ${BROADCAST_ADDR})`,
            });
        }
    });

    // store broadcast addr and identity
    udpSocket.broadcastAddr = BROADCAST_ADDR;
    udpSocket.localIdentity = { ip: localIp, name: ifaceName, mac };
}

function sendMessage(message, name) {
    if (!udpSocket) return;
    const packet = {
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
ipcMain.on("choose-interface", (event, { address, netmask, name, mac }) => {
    setupUDP(address, netmask, name, mac);
});
ipcMain.on("send-udp-message", (event, msg, name) => {
    sendMessage(msg, name);
});

// ---- Electron Window ----
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 650,
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
});
app.on("activate", () => {
    if (!mainWindow) createWindow();
});
