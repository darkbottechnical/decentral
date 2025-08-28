// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("udp", {
    chooseInterface: (iface) => ipcRenderer.send("choose-interface", iface),
    send: (msg, name) => ipcRenderer.send("send-udp-message", msg, name),
    onInterfaces: (callback) =>
        ipcRenderer.on("interfaces-list", (e, list) => callback(list)),
    onMessage: (callback) =>
        ipcRenderer.on("udp-message", (e, data) => callback(data)),
    debug: (callback) => ipcRenderer.on("debug", (e, data) => callback(data)),
});
