async function test() {
  const { execAsync } = await import("ags/process");

  try {
    console.log("Testing CPU parsing...");
    const cpuRaw = await execAsync(["bash", "-c", "LANG=C top -bn1"]);
    console.log("Raw CPU:", cpuRaw.split("\n")[2]); // line 3 has the stats
    const idleMatch = cpuRaw.match(/([\d.,]+)\s+id/);
    if (idleMatch) {
      const val = idleMatch[1].replace(',', '.');
      const idle = parseFloat(val);
      const cpu = 100 - idle;
      console.log(`Parsed ID: ${val}, ID: ${idle}, CPU: ${cpu}`);
    } else {
      console.log("No match for CPU idle!");
    }

    console.log("\nTesting RAM parsing...");
    const memRaw = await execAsync(["bash", "-c", "LANG=C free -m"]);
    console.log("Raw RAM:", memRaw.split("\n")[1]);
    const lines = memRaw.split("\n");
    const memLine = lines.find(l => l.startsWith("Mem:"));
    if (memLine) {
      const parts = memLine.split(/\s+/).filter(Boolean);
      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      const ram = (used / total) * 100;
      console.log(`Total: ${total}, Used: ${used}, RAM%: ${ram}`);
    } else {
      console.log("No match for RAM!");
    }
  } catch (e) {
    console.log("Error:", e);
  }
}

test();
