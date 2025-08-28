const ifaceSelect = document.getElementById("ifaceSelect");
const nameInput = document.getElementById("nameInput");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const log = document.getElementById("log");

let chosen = null;

// populate dropdown when list arrives
window.udp.onInterfaces((list) => {
    ifaceSelect.innerHTML = "";
    list.forEach((iface, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `${iface.name} (${iface.address})`;
        opt.dataset.address = iface.address;
        opt.dataset.netmask = iface.netmask;
        ifaceSelect.appendChild(opt);
    });
});

// when user selects an interface
ifaceSelect.addEventListener("change", () => {
    const opt = ifaceSelect.options[ifaceSelect.selectedIndex];
    chosen = { address: opt.dataset.address, netmask: opt.dataset.netmask };
    window.udp.chooseInterface(chosen);
});

window.udp.onReady((data) => {
    log.value += `\nBound to ${data.localIp}, broadcast ${data.broadcast}`;
});

// send button
sendBtn.onclick = () => {
    if (!chosen) {
        alert("Choose an interface first!");
        return;
    }
    window.udp.send(msgInput.value || "Hello!", nameInput.value || "anon");
};

window.udp.onMessage((data) => {
    log.value += `\n${data.source?.name || "unknown"}: ${data.message}`;
});
