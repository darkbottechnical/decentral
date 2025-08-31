// renderer.js
document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const ifaceSelect = document.getElementById("ifaceSelect");
    const nameInput = document.getElementById("nameInput");
    const statusSelect = document.getElementById("statusSelect");
    const msgInput = document.getElementById("msgInput");
    const sendBtn = document.getElementById("sendBtn");
    const log = document.getElementById("log");
    const statusList = document.getElementById("statusList");

    // --- State ---
    let onlineUsers = [];
    let chosen = null;

    // --- Display Name: Load from localStorage and sync to main process ---
    const savedName = localStorage.getItem("displayName");
    nameInput.value = savedName;
    window.udp.setDisplayName(savedName);

    // --- Log batching to avoid freezing ---
    const logQueue = [];
    let flushing = false;
    function flushLog() {
        if (logQueue.length) {
            log.value += logQueue.join("\n") + "\n";
            logQueue.length = 0;
            log.scrollTop = log.scrollHeight;
        }
        flushing = false;
    }
    function queueLog(msg) {
        logQueue.push(msg);
        if (!flushing) {
            flushing = true;
            requestAnimationFrame(flushLog);
        }
    }

    // --- Interface Dropdown Population ---
    window.udp.onInterfaces((list) => {
        ifaceSelect.innerHTML = "";
        const noOption = document.createElement("option");
        noOption.textContent = "Select interface...";
        noOption.value = "none";
        ifaceSelect.appendChild(noOption);
        list.forEach((iface, i) => {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = `${iface.name} (${
                iface.address
            } | ${iface.mac.replaceAll(":", "")})`;
            opt.dataset.address = iface.address;
            opt.dataset.netmask = iface.netmask;
            opt.dataset.mac = iface.mac;
            ifaceSelect.appendChild(opt);
        });
        ifaceSelect._ifaceList = list;
    });

    // --- Interface Selection Handler ---
    ifaceSelect.addEventListener("change", () => {
        if (ifaceSelect.value != "none") {
            const opt = ifaceSelect.options[ifaceSelect.selectedIndex];
            const iface = ifaceSelect._ifaceList
                ? ifaceSelect._ifaceList[opt.value]
                : null;
            chosen = {
                address: opt.dataset.address,
                netmask: opt.dataset.netmask,
                mac: (iface && iface.mac) || opt.dataset.mac,
                name: opt.textContent,
            };
            // Always send the current display name to main process before choosing interface
            chosen.displayName = nameInput.value;
            window.udp.chooseInterface(chosen);
            onlineUsers = [];
        }
    });

    // --- Display Name Change Handler ---
    nameInput.addEventListener("change", () => {
        window.udp.setDisplayName(nameInput.value);
        localStorage.setItem("displayName", nameInput.value);
    });

    statusSelect.addEventListener("change", () => {
        window.udp.setStatus(statusSelect.value);
    });

    // --- Send Message Helper ---
    function sendMessage() {
        if (!chosen) {
            queueLog("[WARN] No interface selected - message was not sent.");
            return;
        }
        if (!msgInput.value) return;
        if (msgInput.value.length > 500) {
            document.getElementById("status").textContent =
                "Message is too long!";
            return;
        }
        const message = msgInput.value;
        const name = nameInput.value;
        window.udp.send(message, name);
        msgInput.value = "";
        document.getElementById("status").textContent = "";
    }

    // --- Send on Button Click or Enter ---
    sendBtn.addEventListener("click", sendMessage);
    msgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });

    // --- Message Receive Handler ---
    window.udp.onMessage((data) => {
        queueLog(
            `${data.source?.name || "unknown"} [${data.source?.mac.replaceAll(
                ":",
                ""
            )}] -> ${data.dest?.name || "everyone"}:\n  ${data.message}`
        );
    });

    // --- Online Users Rendering ---
    function renderOnlineUsers() {
        statusList.innerHTML = "";
        onlineUsers.forEach((status) => {
            const entry = document.createElement("div");
            entry.className = "status-entry";
            entry.innerHTML = `
                    <span class="status-${status.status}"></span><strong>${
                status.ip
            } [${status.mac.replaceAll(":", "")}]</strong><br/>
                    ${status.name || "unknown"}
                `;
            statusList.appendChild(entry);
        });
    }

    // --- Status Change Handler ---
    window.udp.statusChange((status) => {
        console.log(status);
        if (status.status != "offline" && status.source) {
            if (onlineUsers.some((u) => u.mac === status.source.mac)) {
                onlineUsers.forEach((u) => {
                    if (
                        u.name != status.source.name &&
                        u.mac === status.source.mac
                    ) {
                        console.log(
                            `Updating ${u.mac}: name from ${u.name} to ${status.source.name}`
                        );
                        u.name = status.source.name;
                    }
                    if (
                        u.status != status.status &&
                        u.mac === status.source.mac
                    ) {
                        u.status = status.status;
                    }
                    renderOnlineUsers();
                });
            } else {
                onlineUsers.push({
                    mac: status.source.mac,
                    name: status.source.name,
                    ip: status.source.ip,
                    status: status.status,
                });
                renderOnlineUsers();
            }
        } else if (status.status === "offline" && status.source) {
            onlineUsers = onlineUsers.filter(
                (u) => u.mac !== status.source.mac
            );
            renderOnlineUsers();
        }
    });

    // --- Debug Message Handler ---
    window.udp.debug((data) => {
        queueLog(`[DEBUG] ${data.message}`);
    });
});
