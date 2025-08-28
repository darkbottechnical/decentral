// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const dgram = require("dgram");

const { listIPv4Interfaces, ipToInt, intToIp } = require("./src/ip-helpers.js");

let mainWindow;
let udpSocket;
const PORT = 4123;

async function setupUDP(
    localIp,
    netmask,
    ifaceName = "unknown",
    mac = "unknown"
) {
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
                console.log("Received (parsed):", parsed);
                if (mainWindow) {
                    mainWindow.webContents.send("udp-message", parsed);
                }
            } catch (err) {
                console.warn("Received non-JSON message:", msg.toString());
            }
        });
    });

    await new Promise((resolve, reject) => {
        udpSocket.bind(PORT, localIp, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    udpSocket.setBroadcast(true);
    console.log(
        `Bound UDP socket to ${localIp}:${PORT} (broadcast ${BROADCAST_ADDR})`
    );
    if (mainWindow) {
        mainWindow.webContents.send("debug", {
            message: `Bound to ${localIp}, broadcast ${BROADCAST_ADDR}`,
        });
    }
    // store broadcast addr and identity for sendMessage
    udpSocket.broadcastAddr = BROADCAST_ADDR;
    udpSocket.localIdentity = { ip: localIp, name: ifaceName, mac };
}

async function sendMessage(message, name) {
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
            mac:
                (udpSocket.localIdentity && udpSocket.localIdentity.mac) ||
                "unknown",
        },
        message,
    };
    const buf = Buffer.from(JSON.stringify(packet));
    await new Promise((resolve) => {
        udpSocket.send(
            buf,
            0,
            buf.length,
            PORT,
            udpSocket.broadcastAddr,
            (err) => {
                if (err) console.error("Send error:", err);
                else
                    console.log("Sent:", packet, "->", udpSocket.broadcastAddr);
                resolve();
            }
        );
    });
}

// ---- IPC ----
ipcMain.on(
    "choose-interface",
    async (event, { address, netmask, name, mac }) => {
        await setupUDP(address, netmask, name, mac);
    }
);
ipcMain.on("send-udp-message", async (event, msg, name) => {
    await sendMessage(msg, name);
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

    mainWindow.loadFile("index.html");

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
