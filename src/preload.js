const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("udp", {
    chooseInterface: (iface) => ipcRenderer.send("choose-interface", iface),
    send: (msg) => ipcRenderer.send("send-udp-message", msg),
    onInterfaces: (cb) =>
        ipcRenderer.on("interfaces-list", (e, list) => cb(list)),
    onReady: (cb) => ipcRenderer.on("udp-ready", (e, data) => cb(data)),
    onMessage: (cb) => ipcRenderer.on("udp-message", (e, data) => cb(data)),
});
