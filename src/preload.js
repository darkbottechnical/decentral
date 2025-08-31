// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("udp", {
    chooseInterface: (iface) => ipcRenderer.send("choose-interface", iface),
    send: (msg, name, to = null) =>
        ipcRenderer.send("send-udp-message", msg, name, to ? to : null),
    setDisplayName: (name) => ipcRenderer.send("set-display-name", name),
    setStatus: (status) => ipcRenderer.send("set-status", status),
    onInterfaces: (callback) =>
        ipcRenderer.on("interfaces-list", (e, list) => callback(list)),
    onMessage: (callback) =>
        ipcRenderer.on("udp-message", (e, data) => callback(data)),
    statusChange: (callback) =>
        ipcRenderer.on("status-change", (e, status) => callback(status)),
    debug: (callback) => ipcRenderer.on("debug", (e, data) => callback(data)),
});
