// renderer.js
document.addEventListener("DOMContentLoaded", () => {
    const ifaceSelect = document.getElementById("ifaceSelect");
    const nameInput = document.getElementById("nameInput");
    const msgInput = document.getElementById("msgInput");
    const sendBtn = document.getElementById("sendBtn");
    const log = document.getElementById("log");

    let chosen = null;

    // ---- log batching to avoid freezing ----
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

    // ---- populate dropdown when interfaces list arrives ----
    window.udp.onInterfaces((list) => {
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
        // Save the list for later lookup
        ifaceSelect._ifaceList = list;
    });

    // ---- interface selection ----
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
            window.udp.chooseInterface(chosen);
        }
    });

    // ---- send message helper ----
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
        const name = nameInput.value || "anon";
        window.udp.send(message, name);
        msgInput.value = "";
        document.getElementById("status").textContent = "";
    }

    // ---- send on button click or enter ----
    sendBtn.addEventListener("click", sendMessage);

    msgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });

    // ---- receive messages ----
    window.udp.onMessage((data) => {
        queueLog(
            `${data.source?.name || "unknown"} [${data.source?.mac.replaceAll(
                ":",
                ""
            )}] -> ${data.dest?.name || "everyone"}:\n  ${data.message}`
        );
    });

    // ---- debug messages ----
    window.udp.debug((data) => {
        queueLog(`[DEBUG] ${data.message}`);
    });
});
