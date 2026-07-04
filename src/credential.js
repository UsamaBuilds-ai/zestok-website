const fs = require("fs");
const path = require("path");

const CONFIG_FILE = "app-config.json";

function getPath(userDataPath) {
  return path.join(userDataPath, CONFIG_FILE);
}

function save(userDataPath, data) {
  const filePath = getPath(userDataPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function load(userDataPath) {
  const filePath = getPath(userDataPath);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function has(userDataPath) {
  return fs.existsSync(getPath(userDataPath));
}

function remove(userDataPath) {
  const filePath = getPath(userDataPath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = { save, load, has, remove };
