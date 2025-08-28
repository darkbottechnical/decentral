// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const dgram = require("dgram");

let mainWindow;
let udpSocket;
const PORT = 4123;

// ---- Interface helpers ----
function listIPv4Interfaces() {
    const nets = os.networkInterfaces();
    const addrs = [];
    for (const name of Object.keys(nets)) {
        for (const ni of nets[name]) {
            if (ni.family === "IPv4" && !ni.internal) {
                addrs.push({ name, address: ni.address, netmask: ni.netmask });
            }
        }
    }
    return addrs;
}
function ipToInt(ip) {
    return (
        ip
            .split(".")
            .reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0
    );
}
function intToIp(i) {
    return [
        (i >>> 24) & 0xff,
        (i >>> 16) & 0xff,
        (i >>> 8) & 0xff,
        i & 0xff,
    ].join(".");
}

// ---- UDP Setup (after user chooses interface) ----
function setupUDP(localIp, netmask) {
    if (udpSocket) udpSocket.close(); // reset if already bound
    udpSocket = dgram.createSocket("udp4");

    const ipInt = ipToInt(localIp);
    const maskInt = ipToInt(netmask);
    const broadcastInt = (ipInt & maskInt) | (~maskInt >>> 0);
    const BROADCAST_ADDR = intToIp(broadcastInt);

    udpSocket.on("message", (msg, rinfo) => {
        console.log(`Received: ${msg} from ${rinfo.address}:${rinfo.port}`);
        if (mainWindow) {
            mainWindow.webContents.send("udp-message", {
                message: msg.toString(),
                from: `${rinfo.address}:${rinfo.port}`,
            });
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

    // store broadcast addr for sendMessage
    udpSocket.broadcastAddr = BROADCAST_ADDR;
}

function sendMessage(message) {
    if (!udpSocket) return;
    const buf = Buffer.from(message);
    udpSocket.send(buf, 0, buf.length, PORT, udpSocket.broadcastAddr, (err) => {
        if (err) console.error("Send error:", err);
        else console.log("Sent:", message, "->", udpSocket.broadcastAddr);
    });
}

// ---- IPC ----
ipcMain.on("choose-interface", (event, { address, netmask }) => {
    setupUDP(address, netmask);
});
ipcMain.on("send-udp-message", (event, msg) => {
    sendMessage(msg);
});

// ---- Electron window ----
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
