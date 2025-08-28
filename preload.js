const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("udp", {
    send: (msg) => ipcRenderer.send("send-udp-message", msg),
    onMessage: (callback) =>
        ipcRenderer.on("udp-message", (event, data) => callback(data)),
});
