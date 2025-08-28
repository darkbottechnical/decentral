// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const dgram = require("dgram");

const { listIPv4Interfaces, ipToInt, intToIp } = require("./src/ip-helpers.js");

let mainWindow;
let udpSocket;
const PORT = 4123;

function setupUDP(localIp, netmask, ifaceName = "unknown") {
    if (udpSocket) udpSocket.close(); // reset if already bound
    udpSocket = dgram.createSocket("udp4");

    const ipInt = ipToInt(localIp);
    const maskInt = ipToInt(netmask);
    const broadcastInt = (ipInt & maskInt) | (~maskInt >>> 0);
    const BROADCAST_ADDR = intToIp(broadcastInt);

    udpSocket.on("message", (msg, rinfo) => {
        try {
            const parsed = JSON.parse(msg.toString());
            console.log("Received (parsed):", parsed);
            if (mainWindow) {
                mainWindow.webContents.send("udp-message", parsed);
            }
        } catch (err) {
            console.warn("Received non-JSON message:", msg.toString());
        }
    });

    udpSocket.bind(PORT, localIp, () => {
        udpSocket.setBroadcast(true);
        console.log(
            `Bound UDP socket to ${localIp}:${PORT} (broadcast ${BROADCAST_ADDR})`
        );
        // let renderer know binding succeeded
        mainWindow.webContents.send("udp-ready", {
            localIp,
            broadcast: BROADCAST_ADDR,
        });
    });

    // store broadcast addr and identity for sendMessage
    udpSocket.broadcastAddr = BROADCAST_ADDR;
    udpSocket.localIdentity = { ip: localIp, name: ifaceName };
}

function sendMessage(message, name) {
    if (!udpSocket) return;
    const packet = {
        source: {
            ip:
                (udpSocket.localIdentity && udpSocket.localIdentity.ip) ||
                "unknown",
            name:
                name ||
                (udpSocket.localIdentity && udpSocket.localIdentity.name) ||
                "unknown",
        },
        message,
    };
    const buf = Buffer.from(JSON.stringify(packet));
    udpSocket.send(buf, 0, buf.length, PORT, udpSocket.broadcastAddr, (err) => {
        if (err) console.error("Send error:", err);
        else console.log("Sent:", packet, "->", udpSocket.broadcastAddr);
    });
}

// ---- IPC ----
ipcMain.on("choose-interface", (event, { address, netmask, name }) => {
    setupUDP(address, netmask, name);
});
ipcMain.on("send-udp-message", (event, msg, name) => {
    sendMessage(msg, name);
});

//
// ---- Electron window ----
//

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "src/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile("src/index.html");

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.webContents.on("did-finish-load", () => {
        // send interfaces list after UI loads
        const interfaces = listIPv4Interfaces();
        mainWindow.webContents.send("interfaces-list", interfaces);
    });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
    if (mainWindow === null) createWindow();
});
