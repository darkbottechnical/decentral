// ---- Interface helpers ----
const os = require("os");

function listIPv4Interfaces() {
    const nets = os.networkInterfaces();
    const addrs = [];
    for (const name of Object.keys(nets)) {
        for (const ni of nets[name]) {
            if (ni.family === "IPv4" && !ni.internal) {
                addrs.push({
                    name,
                    address: ni.address,
                    netmask: ni.netmask,
                    mac: ni.mac,
                });
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

module.exports = { listIPv4Interfaces, ipToInt, intToIp };
