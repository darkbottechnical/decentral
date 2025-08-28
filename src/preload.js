const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("udp", {
    chooseInterface: (iface) => ipcRenderer.send("choose-interface", iface),
    send: (msg, name) => ipcRenderer.send("send-udp-message", msg, name),
    onInterfaces: (cb) =>
        ipcRenderer.on("interfaces-list", (e, list) => cb(list)),
    onReady: (cb) => ipcRenderer.on("udp-ready", (e, data) => cb(data)),
    onMessage: (cb) => ipcRenderer.on("udp-message", (e, data) => cb(data)),
});
