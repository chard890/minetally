
const dateStr = "2026-03-15T00:00:00.000Z";
const date = new Date(dateStr);

console.log("Input:", dateStr);
console.log("UTC Hours:", date.getUTCHours());
console.log("Local Hours:", date.getHours());

const untilDate = new Date(date);
if (untilDate.getHours() === 0 && untilDate.getMinutes() === 0) {
    untilDate.setHours(23, 59, 59, 999);
    console.log("Local trigger fired");
}

const untilDateUTC = new Date(date);
if (untilDateUTC.getUTCHours() === 0 && untilDateUTC.getUTCMinutes() === 0) {
    untilDateUTC.setUTCHours(23, 59, 59, 999);
    console.log("UTC trigger fired");
}

console.log("Local set result (UTC string):", untilDate.toISOString());
console.log("UTC set result (UTC string):", untilDateUTC.toISOString());
console.log("Local set result (Unix):", Math.floor(untilDate.getTime() / 1000));
console.log("UTC set result (Unix):", Math.floor(untilDateUTC.getTime() / 1000));
